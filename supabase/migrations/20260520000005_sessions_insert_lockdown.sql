-- [Audyt iteracja 3] Domknięcie strategii column protection dla tabeli sessions
-- + RPC complete_session + lockdown publicznych RPC.
--
-- Trzeci audyt wykrył regresje:
--   #1 (HIGH): sessions_insert_tutor wymagał tylko tutor_id=auth.uid().
--             Tutor mógł wstawić sesję dla DOWOLNEGO student_id z własnym
--             daily_room_url/host_room_url -> phishing wideo.
--   #2 (HIGH): trigger sessions_protect_columns nie blokował studentowi
--             zmiany sessions.status. Student mógł natychmiast oznaczyć
--             sesję jako completed i wystawić sabotażową ocenę.
--   #6:       Brak DELETE policy na sessions — rollback w acceptMatchingRequest
--             zostawiał osierocone wiersze (matching_request_id UNIQUE blokował retry).
--   #9:       expire_pending_requests miał EXECUTE TO PUBLIC.
--   #3:       tutor_subjects_own używał for all bez explicit with check.

-- ============================================================
-- matching_requests: rozszerzenie triggera o accepted→completed dla studenta
-- ============================================================
-- RPC complete_session aktualizuje zarówno sessions jak i matching_requests.
-- Trigger matching_requests_protect_columns blokował przejście accepted→completed
-- inicjowane przez studenta — RPC (uruchamiana w sesji studenta) nie mogła
-- propagować statusu. Dopuszczamy ten przepływ jednorazowo; ochrona przed
-- nadużyciami: bezpośredni UPDATE jest dodatkowo blokowany przez RLS
-- matching_requests_tutor_complete (wymaga tutor_id=auth.uid()).

create or replace function public.matching_requests_protect_columns()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if new.student_id is distinct from old.student_id
     or new.subject_id is distinct from old.subject_id
     or new.description is distinct from old.description
     or new.level is distinct from old.level
     or new.scope is distinct from old.scope
     or new.expires_at is distinct from old.expires_at
     or new.created_at is distinct from old.created_at then
    raise exception 'Modyfikacja chronionej kolumny matching_requests niedozwolona';
  end if;

  if auth.uid() = old.student_id then
    if new.tutor_id is distinct from old.tutor_id then
      raise exception 'Student nie może zmieniać tutor_id na zleceniu';
    end if;
    if new.status is distinct from old.status
       and not (new.status = 'cancelled' and old.status = 'pending')
       and not (new.status = 'completed' and old.status = 'accepted') then
      raise exception 'Niedozwolone przejście statusu zlecenia ze stanu % do %', old.status, new.status;
    end if;
  end if;

  return new;
end;
$$;

-- ============================================================
-- sessions: BEFORE INSERT trigger — wymuś NULL na polach initial-setup
-- ============================================================
-- Atak: tutor INSERT z host_room_url='evil' przechodził, bo polityka nie sprawdzała
-- treści tych pól. Aplikacja ma flow 2-step: INSERT (minimal) → UPDATE (z room data).
-- Trigger zeruje wszystkie pola initial-setup w INSERT, wymuszając że tylko
-- UPDATE może je ustawić — a UPDATE jest już chronione przez sessions_protect_columns.
create or replace function public.sessions_normalize_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    return new;  -- service role bypass
  end if;
  new.daily_room_name := null;
  new.daily_room_url := null;
  new.host_room_url := null;
  new.started_at := null;
  new.ended_at := null;
  new.duration_minutes := null;
  new.notes := null;
  new.status := 'scheduled';
  return new;
end;
$$;

create trigger sessions_normalize_insert_trg
  before insert on public.sessions
  for each row execute function public.sessions_normalize_insert();

-- ============================================================
-- sessions: zaostrzenie sessions_insert_tutor o spójność z matching_requests
-- ============================================================
drop policy if exists "sessions_insert_tutor" on public.sessions;
create policy "sessions_insert_tutor" on public.sessions
  for insert to authenticated
  with check (
    tutor_id = auth.uid()
    and exists (
      select 1 from public.matching_requests mr
      where mr.id = matching_request_id
        and mr.tutor_id = auth.uid()
        and mr.student_id = sessions.student_id
        and mr.status in ('accepted', 'completed')
    )
  );

-- ============================================================
-- sessions: rozszerzenie triggera o ochronę status/ended_at przed studentem
-- ============================================================
create or replace function public.sessions_protect_columns()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_natural_end timestamptz;
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

  -- Pola initial-setup-only
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

  -- Reguły student-only. Sabotaż "natychmiast oznaczę sesję jako completed
  -- i wystawię 1-gwiazdkową ocenę" blokujemy tym, że student może zmienić
  -- status na 'completed' DOPIERO po naturalnym końcu sesji (started_at +
  -- duration_minutes). Auto-end po stronie klienta (VideoSession.tsx) odpala
  -- się dokładnie w tym momencie, więc legalna ścieżka działa.
  if auth.uid() = old.student_id and auth.uid() <> old.tutor_id then
    if new.daily_room_name is distinct from old.daily_room_name
       or new.daily_room_url is distinct from old.daily_room_url
       or new.host_room_url is distinct from old.host_room_url
       or new.started_at is distinct from old.started_at
       or new.duration_minutes is distinct from old.duration_minutes
       or new.notes is distinct from old.notes then
      raise exception 'Student nie może modyfikować pól sesji zarezerwowanych dla korepetytora';
    end if;
    if new.status is distinct from old.status then
      if new.status <> 'completed'
         or old.started_at is null
         or old.duration_minutes is null then
        raise exception 'Student może oznaczyć sesję jako completed dopiero po naturalnym końcu';
      end if;
      -- Tolerancja 10 sekund — kliencki timer może odpalić auto-end kilka
      -- sekund przed serwerowym now() ze względu na clock drift między
      -- przeglądarką a bazą. Bez tej rezerwy legalny auto-end zostawałby
      -- zablokowany na granicy czasu.
      v_natural_end := old.started_at + (old.duration_minutes * interval '1 minute');
      if v_natural_end > now() + interval '10 seconds' then
        raise exception 'Naturalny koniec sesji jeszcze nie nadszedł';
      end if;
    end if;
  end if;

  return new;
end;
$$;

-- ============================================================
-- RPC complete_session — kanoniczna ścieżka zakończenia sesji
-- ============================================================
-- Zarówno student (auto-end po timerze) jak i tutor (klik "Zakończ") wywołują
-- ten sam RPC. SECURITY DEFINER omija RLS i nasz trigger; logika autoryzacji
-- jest w funkcji: sprawdzamy że auth.uid() jest uczestnikiem, że notes ustawia
-- tylko tutor, że sesja nie jest już zakończona. To eliminuje atak z luki #2
-- (student wpisuje status=completed przed czasem) bo trigger nadal blokuje
-- bezpośrednie UPDATE — można tylko przez RPC, który zachowuje poprawność biznesową.

create or replace function public.complete_session(
  p_session_id uuid,
  p_notes text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_student uuid;
  v_tutor uuid;
  v_status text;
  v_matching_request_id uuid;
begin
  select student_id, tutor_id, status, matching_request_id
    into v_student, v_tutor, v_status, v_matching_request_id
  from public.sessions
  where id = p_session_id;

  if not found then
    raise exception 'Nie znaleziono sesji';
  end if;

  if auth.uid() is null then
    raise exception 'Wymagane uwierzytelnienie';
  end if;

  if auth.uid() <> v_student and auth.uid() <> v_tutor then
    raise exception 'Brak uprawnień do tej sesji';
  end if;

  if v_status = 'completed' then
    return;
  end if;

  -- Notatki sesji ustawia wyłącznie korepetytor; student może zakończyć,
  -- ale jego notes są ignorowane.
  if p_notes is not null and length(p_notes) > 0 and auth.uid() = v_tutor then
    update public.sessions
    set status = 'completed', ended_at = now(), notes = p_notes
    where id = p_session_id;
  else
    update public.sessions
    set status = 'completed', ended_at = now()
    where id = p_session_id;
  end if;

  -- Propagacja statusu na matching_request
  if v_matching_request_id is not null then
    update public.matching_requests
    set status = 'completed'
    where id = v_matching_request_id
      and status = 'accepted';
  end if;
end;
$$;

revoke execute on function public.complete_session(uuid, text) from public, anon;
grant execute on function public.complete_session(uuid, text) to authenticated;

-- ============================================================
-- sessions: DELETE policy dla rollback w acceptMatchingRequest
-- ============================================================
-- Bez polityki DELETE rollback po nieudanym createVideoRoom zostawiał osieroconą
-- sesję, a unikalność matching_request_id blokowała kolejną akceptację.
-- Tutor może usunąć tylko własną świeżą sesję (status='scheduled', bez room URL).
create policy "sessions_delete_tutor_scheduled" on public.sessions
  for delete to authenticated
  using (
    tutor_id = auth.uid()
    and status = 'scheduled'
    and daily_room_url is null
  );

-- ============================================================
-- tutor_subjects: explicit polityki (defense in depth)
-- ============================================================
-- "for all using (auth.uid() = tutor_id)" działało, ale styl był niespójny
-- z resztą migracji. Rozbijamy na SELECT/INSERT/DELETE z jawnym with check.
drop policy if exists "tutor_subjects_own" on public.tutor_subjects;
create policy "tutor_subjects_own_select" on public.tutor_subjects
  for select to authenticated using (auth.uid() = tutor_id);
create policy "tutor_subjects_own_insert" on public.tutor_subjects
  for insert to authenticated with check (auth.uid() = tutor_id);
create policy "tutor_subjects_own_delete" on public.tutor_subjects
  for delete to authenticated using (auth.uid() = tutor_id);

-- ============================================================
-- expire_pending_requests: revoke EXECUTE TO PUBLIC/anon
-- ============================================================
-- Domyślnie funkcje SECURITY DEFINER są wykonywalne przez PUBLIC.
-- Cofamy z public i anon, zostawiamy authenticated — RPC jest wywoływane
-- przez getTutorPendingRequests (queries.ts) w kontekście zalogowanego
-- korepetytora jako lazy expiry housekeeping. Funkcja jest idempotentna,
-- więc spam zalogowanego użytkownika nie wyrządza szkody.
revoke execute on function public.expire_pending_requests() from public, anon;