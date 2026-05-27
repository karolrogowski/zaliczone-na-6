-- ============================================================
-- ADR-006: Dwustronny system ocen z Wilson score i soft-flagiem
-- ============================================================
-- Kontekst: poprzednia implementacja pozwalała tylko uczniowi na ocenę
-- korepetytora. ADR-006 dodaje:
--   1. Ocenę korepetytora → ucznia (wewnętrzna, do detekcji toksycznych)
--   2. Wilson score zamiast prostej średniej w rankingu
--   3. Soft flag podejrzanych ocen (admin do weryfikacji)
--   4. RPC get_pending_rating dla middleware (twarda blokada 4h)

-- ============================================================
-- 1. Rozszerzenie tabeli ratings
-- ============================================================

-- rated_by: kto wystawia ocenę — student (publiczna) lub tutor (wewnętrzna)
alter table public.ratings
  add column rated_by text not null default 'student'
  check (rated_by in ('student', 'tutor'));

-- preference: preferencja ucznia względem korepetytora (tylko dla rated_by='student')
-- want_again → "chcę się uczyć z tym korepetytorem"
-- avoid      → "nie polecaj mi tego korepetytora"
alter table public.ratings
  add column preference text
  check (preference in ('want_again', 'avoid'));

-- flagged_for_review: podejrzana ocena czeka na decyzję admina
alter table public.ratings
  add column flagged_for_review boolean not null default false;

-- Nowa unikalność: jedna ocena NA (sesja × strona) zamiast tylko na sesję
alter table public.ratings drop constraint ratings_session_id_key;
alter table public.ratings
  add constraint ratings_session_rated_by_unique unique (session_id, rated_by);

-- ============================================================
-- 2. Wilson score w tutor_profiles + unrated_streak w profiles
-- ============================================================

-- wilson_score: dolna granica 95% CI proporcji pozytywności (null poniżej progu 5 ocen)
alter table public.tutor_profiles
  add column wilson_score numeric(6, 4);

-- unrated_streak: licznik kolejnych sesji bez oceny
-- Konsekwencje (ADR-006 §6) są AFTER_MVP (VIP tier). Kolumna już teraz.
alter table public.profiles
  add column unrated_streak integer not null default 0;

-- ============================================================
-- 3. Aktualizacja polityki INSERT dla ucznia
-- ============================================================
-- Poprzednia polityka (z migracji security_fixes) nie zawierała rated_by.
-- Nowa wersja wymaga rated_by = 'student' i zachowuje warunek tutor_id.
drop policy if exists "ratings_student_insert" on public.ratings;

create policy "ratings_student_insert" on public.ratings
  for insert to authenticated
  with check (
    rated_by = 'student'
    and auth.uid() = student_id
    and exists (
      select 1 from public.sessions s
      where s.id         = session_id
        and s.student_id = auth.uid()
        and s.tutor_id   = ratings.tutor_id
        and s.status     = 'completed'
    )
  );

-- ============================================================
-- 4. Nowa polityka INSERT dla korepetytora
-- ============================================================
-- Analogia do student_insert: tutor może ocenić ucznia tylko ze swojej
-- ukończonej sesji. Ocena nie jest publiczna — służy detekcji toksycznych.
create policy "ratings_tutor_insert" on public.ratings
  for insert to authenticated
  with check (
    rated_by = 'tutor'
    and auth.uid() = tutor_id
    and exists (
      select 1 from public.sessions s
      where s.id         = session_id
        and s.tutor_id   = auth.uid()
        and s.student_id = ratings.student_id
        and s.status     = 'completed'
    )
  );

-- ============================================================
-- 5. refresh_tutor_rating z Wilson score lower bound (95% CI)
-- ============================================================
-- Wzór Wilsona: score = (p̂ + z²/2n − z√(p̂(1−p̂)/n + z²/4n²)) / (1 + z²/n)
--   p̂ = avg_stars / 5.0   (proporcja "pozytywności" 0–1)
--   n  = liczba ocen od uczniów
--   z  = 1.96              (95% CI)
-- Próg wejścia do algorytmu: n >= 5. Poniżej wilson_score = null.
create or replace function public.refresh_tutor_rating()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count  integer;
  v_avg    numeric;
  v_p      numeric;
  v_z      constant numeric := 1.96;
  v_wilson numeric;
begin
  -- Oceny korepetytora→ucznia nie wpływają na publiczny ranking; early-return.
  if new.rated_by <> 'student' then
    return new;
  end if;

  -- Tylko oceny od uczniów wchodzą do publicznego rankingu korepetytora
  select
    count(*)::integer,
    round(avg(score)::numeric, 2)
  into v_count, v_avg
  from public.ratings
  where tutor_id = new.tutor_id
    and rated_by = 'student';

  -- Wilson score lower bound
  if v_count >= 5 then
    v_p := v_avg / 5.0;
    v_wilson := (
        v_p
        + (v_z * v_z) / (2.0 * v_count)
        - v_z * sqrt(v_p * (1.0 - v_p) / v_count + (v_z * v_z) / (4.0 * v_count * v_count))
    ) / (1.0 + (v_z * v_z) / v_count);
    v_wilson := round(v_wilson, 4);
  else
    v_wilson := null;
  end if;

  update public.tutor_profiles
  set
    rating_count = v_count,
    rating_avg   = v_avg,
    wilson_score = v_wilson
  where id = new.tutor_id;

  return new;
end;
$$;

-- ============================================================
-- 6. Trigger detekcji anomalii — soft flag, NIE automatyczne usuwanie
-- ============================================================
-- Warunek: korepetytor miał ≥ 10 ocen ze średnią ≥ 4.5★ PRZED tą oceną
-- i otrzymuje ocenę 1–2★.
-- Skutek: flagged_for_review = true → wpis w panelu admina "do weryfikacji".
-- Decyzja (usunąć / potwierdzić) należy wyłącznie do admina.
create or replace function public.flag_suspicious_rating()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_prev_count integer;
  v_prev_avg   numeric;
begin
  -- Flagujemy tylko oceny od uczniów (widoczne publicznie)
  if new.rated_by <> 'student' then
    return new;
  end if;

  -- Oceny 3–5 nigdy nie są podejrzane
  if new.score > 2 then
    return new;
  end if;

  -- Policz stan PRZED tym insertem: trigger jest AFTER INSERT, więc
  -- count(*) zawiera już nowy wiersz. Odejmujemy 1 i korygujemy średnią.
  select
    (count(*) - 1)::integer,
    case
      when count(*) > 1
      then (avg(score) * count(*)::numeric - new.score::numeric)
           / (count(*) - 1)::numeric
      else null
    end
  into v_prev_count, v_prev_avg
  from public.ratings
  where tutor_id = new.tutor_id
    and rated_by = 'student';

  -- Warunek: przed tą oceną było >= 10 ocen ze średnią >= 4.5
  if v_prev_count >= 10 and v_prev_avg >= 4.5 then
    update public.ratings
    set flagged_for_review = true
    where id = new.id;
  end if;

  return new;
end;
$$;

create trigger ratings_flag_suspicious_trg
  after insert on public.ratings
  for each row execute function public.flag_suspicious_rating();

-- ============================================================
-- 7. RPC get_pending_rating — używane przez middleware (blokada 4h)
-- ============================================================
-- Zwraca matching_request_id sesji, która spełnia:
--   - status = 'completed'
--   - zakończyła się mniej niż 4 godziny temu
--   - p_user_id jest uczestnikiem (student lub tutor)
--   - użytkownik jeszcze nie wystawił swojej strony oceny
-- Zwraca null gdy brak oczekujących ocen.
create or replace function public.get_pending_rating(p_user_id uuid)
returns uuid
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  v_role   text;
  v_result uuid;
begin
  select role into v_role
  from public.profiles
  where id = p_user_id;

  select mr.id into v_result
  from public.sessions s
  join public.matching_requests mr on mr.id = s.matching_request_id
  where s.status   = 'completed'
    and s.ended_at > now() - interval '4 hours'
    and (
      -- Uczeń nie wystawił oceny
      (v_role = 'student'
       and s.student_id = p_user_id
       and not exists (
         select 1 from public.ratings r
         where r.session_id = s.id
           and r.rated_by   = 'student'
       ))
      or
      -- Korepetytor nie wystawił oceny
      (v_role = 'tutor'
       and s.tutor_id = p_user_id
       and not exists (
         select 1 from public.ratings r
         where r.session_id = s.id
           and r.rated_by   = 'tutor'
       ))
    )
  order by s.ended_at desc
  limit 1;

  return v_result;
end;
$$;

revoke execute on function public.get_pending_rating(uuid) from public, anon;
grant  execute on function public.get_pending_rating(uuid) to authenticated;
