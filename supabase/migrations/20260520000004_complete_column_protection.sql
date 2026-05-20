-- [Audyt iteracja 2] Pełna ochrona kolumn dla matching_requests, sessions,
-- ratings i profiles.
--
-- Tło: w poprzedniej iteracji audytu strategia "RLS split + trigger + column
-- GRANT" objęła tylko część tabel/operacji. Drugi audyt wykrył 4 luki HIGH
-- wynikające z niekompletnego pokrycia:
--   1.1  Trigger matching_requests_protect_columns chronił tylko studenta
--        — korepetytor mógł przy accept'cie nadpisać student_id, expires_at,
--        description, level, scope.
--   1.2  Sessions UPDATE bez ograniczeń kolumnowych — uczeń mógł przepisać
--        host_room_url na URL kontrolowanego pokoju.
--   1.3  Ratings INSERT akceptował dowolny tutor_id — uczeń mógł zatopić
--        konkurencyjnych korepetytorów ocenami 1-gwiazdkowymi.
--   1.4  Matching_requests INSERT przyjmował dowolny expires_at — DoS przez
--        zlecenia nigdy nie wygasające.
--   2.2  Profiles.SELECT bez ograniczeń kolumnowych — kolumna phone widoczna
--        dla każdego, kto może czytać profil korepetytora/ucznia z sesji.
--
-- Strategia: triggery porównujące NEW vs OLD pomijają service role
-- (auth.uid() IS NULL), więc admin/RPC SECURITY DEFINER mają dostęp pełny.

-- ============================================================
-- matching_requests — zastąpienie triggera dla pełnego pokrycia
-- ============================================================
drop trigger if exists matching_requests_protect_columns_trg on public.matching_requests;
drop function if exists public.matching_requests_protect_columns();

create or replace function public.matching_requests_protect_columns()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Service role (auth.uid() IS NULL) ma pełny dostęp
  if auth.uid() is null then
    return new;
  end if;

  -- Pola immutowalne dla każdego authenticated użytkownika
  if new.student_id is distinct from old.student_id
     or new.subject_id is distinct from old.subject_id
     or new.description is distinct from old.description
     or new.level is distinct from old.level
     or new.scope is distinct from old.scope
     or new.expires_at is distinct from old.expires_at
     or new.created_at is distinct from old.created_at then
    raise exception 'Modyfikacja chronionej kolumny matching_requests niedozwolona';
  end if;

  -- Reguły specyficzne dla właściciela-studenta
  if auth.uid() = old.student_id then
    if new.tutor_id is distinct from old.tutor_id then
      raise exception 'Student nie może zmieniać tutor_id na zleceniu';
    end if;
    -- Student może tylko anulować zlecenie ze statusu pending
    if new.status is distinct from old.status
       and not (new.status = 'cancelled' and old.status = 'pending') then
      raise exception 'Student może tylko anulować zlecenie ze statusu pending';
    end if;
  end if;

  return new;
end;
$$;

create trigger matching_requests_protect_columns_trg
  before update on public.matching_requests
  for each row execute function public.matching_requests_protect_columns();

-- ============================================================
-- matching_requests — normalizacja BEFORE INSERT
-- ============================================================
-- Atak: uczeń mógł INSERT-ować z `expires_at: '2099-01-01'` i takie zlecenie
-- nigdy nie wygasało. Trigger nadpisuje wartości kontrolowanych pól.

create or replace function public.matching_requests_normalize_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Service role może wstawiać dowolne wartości (testy, seed, migracje)
  if auth.uid() is null then
    return new;
  end if;

  -- Wymuszamy domyślne wartości niezależnie od tego, co przysłał klient
  new.expires_at := now() + interval '5 minutes';
  new.tutor_id := null;
  new.status := 'pending';
  new.created_at := now();
  new.updated_at := now();
  new.student_id := auth.uid();

  return new;
end;
$$;

create trigger matching_requests_normalize_insert_trg
  before insert on public.matching_requests
  for each row execute function public.matching_requests_normalize_insert();

-- ============================================================
-- sessions — trigger immutable-once-set + ochrona kluczowych pól
-- ============================================================
-- Atak: uczeń mógł `update sessions set host_room_url = 'evil', tutor_id='x'`.
-- Strategia: kolumny "tożsamości" (student_id, tutor_id, matching_request_id)
-- nigdy się nie zmieniają; kolumny inicjalne (daily_room_*, host_room_url,
-- started_at, duration_minutes) mogą być ustawione raz (gdy stara wartość
-- NULL), ale potem są niemutowalne.

create or replace function public.sessions_protect_columns()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  -- Pola tożsamości — nigdy nie zmieniane przez authenticated
  if new.student_id is distinct from old.student_id
     or new.tutor_id is distinct from old.tutor_id
     or new.matching_request_id is distinct from old.matching_request_id
     or new.created_at is distinct from old.created_at then
    raise exception 'Modyfikacja tożsamości sesji niedozwolona';
  end if;

  -- Pola initial-setup-only — zmiana dozwolona tylko gdy stara wartość była NULL
  if old.daily_room_name is not null and new.daily_room_name is distinct from old.daily_room_name then
    raise exception 'daily_room_name jest już ustawione i nie może być zmienione';
  end if;
  if old.daily_room_url is not null and new.daily_room_url is distinct from old.daily_room_url then
    raise exception 'daily_room_url jest już ustawione i nie może być zmienione';
  end if;
  if old.host_room_url is not null and new.host_room_url is distinct from old.host_room_url then
    raise exception 'host_room_url jest już ustawione i nie może być zmienione';
  end if;
  if old.started_at is not null and new.started_at is distinct from old.started_at then
    raise exception 'started_at jest już ustawione i nie może być zmienione';
  end if;
  if old.duration_minutes is not null and new.duration_minutes is distinct from old.duration_minutes then
    raise exception 'duration_minutes jest już ustawione i nie może być zmienione';
  end if;

  -- Tylko korepetytor może ustawiać initial-setup-only fields (przy accept)
  -- oraz notes (przy completeSession). Student ma right tylko do status/ended_at.
  if auth.uid() = old.student_id and auth.uid() <> old.tutor_id then
    if new.daily_room_name is distinct from old.daily_room_name
       or new.daily_room_url is distinct from old.daily_room_url
       or new.host_room_url is distinct from old.host_room_url
       or new.started_at is distinct from old.started_at
       or new.duration_minutes is distinct from old.duration_minutes
       or new.notes is distinct from old.notes then
      raise exception 'Student nie może modyfikować pól sesji zarezerwowanych dla korepetytora';
    end if;
  end if;

  return new;
end;
$$;

create trigger sessions_protect_columns_trg
  before update on public.sessions
  for each row execute function public.sessions_protect_columns();

-- Dodatkowo: zaostrzamy istniejącą politykę o with check (była tylko using)
drop policy if exists "sessions_update_participant" on public.sessions;
create policy "sessions_update_participant" on public.sessions
  for update to authenticated
  using (auth.uid() = student_id or auth.uid() = tutor_id)
  with check (auth.uid() = student_id or auth.uid() = tutor_id);

-- ============================================================
-- ratings — wymóg dopasowania tutor_id do sessions.tutor_id
-- ============================================================
-- Atak: uczeń mógł wystawić ocenę dowolnemu korepetytorowi (nie temu,
-- który prowadził sesję) i zatopić konkurencję. Polityka sprawdzała tylko
-- czy sesja należy do studenta — nie czy tutor_id w ratings odpowiada
-- tutor_id sesji.

drop policy if exists "ratings_student_insert" on public.ratings;
create policy "ratings_student_insert" on public.ratings
  for insert to authenticated
  with check (
    auth.uid() = student_id
    and exists (
      select 1 from public.sessions s
      where s.id = session_id
        and s.student_id = auth.uid()
        and s.tutor_id = ratings.tutor_id
        and s.status = 'completed'
    )
  );

-- ============================================================
-- profiles — ukryj kolumnę phone przed innymi użytkownikami
-- ============================================================
-- Atak: zapytanie `select phone from profiles where role='tutor'` zwracało
-- numery wszystkich korepetytorów. Dziś NULL (UI nie wpisuje), ale każdy
-- seed lub admin-update upubliczniłby PII.

revoke select on public.profiles from authenticated;
grant select (id, role, full_name, avatar_url, created_at, updated_at)
  on public.profiles to authenticated;

-- RPC dla samodzielnego dostępu do własnego phone (jeśli kiedyś UI doda)
create or replace function public.get_own_phone()
returns text
language sql
security definer
set search_path = ''
stable
as $$
  select phone from public.profiles where id = auth.uid();
$$;

grant execute on function public.get_own_phone() to authenticated;