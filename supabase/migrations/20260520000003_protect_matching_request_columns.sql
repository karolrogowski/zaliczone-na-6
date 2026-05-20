-- [Vuln 4.3] Ochrona przed manipulacją chronionych kolumn w matching_requests
-- przez studenta.
--
-- Problem: polityka "matching_requests_student_own" była "for all" bez "with check"
-- ani ograniczeń kolumnowych. Student mógł z konsoli wykonać:
--   update matching_requests set expires_at = now() + interval '999 days'
-- co powodowało że zlecenie nigdy nie wygasało, lub
--   update matching_requests set tutor_id = <obcy uuid>
-- co fałszowało dane o korepetytorze.
--
-- Rozwiązanie:
--   1. Split "for all" na osobne polityki SELECT/INSERT/UPDATE z "with check".
--   2. Trigger BEFORE UPDATE blokujący zmianę chronionych kolumn przez studenta.
--      Trigger nie aktywuje się przy service role (auth.uid() = NULL) — admin
--      i RPC SECURITY DEFINER mogą wykonywać dowolne zmiany.

-- ============================================================
-- Split policy
-- ============================================================
drop policy if exists "matching_requests_student_own" on public.matching_requests;

create policy "matching_requests_student_select" on public.matching_requests
  for select to authenticated
  using (auth.uid() = student_id);

create policy "matching_requests_student_insert" on public.matching_requests
  for insert to authenticated
  with check (
    auth.uid() = student_id
    -- Student nie może przy insercie ustawić tutor_id ani statusu innego niż 'pending'
    and tutor_id is null
    and status = 'pending'
  );

create policy "matching_requests_student_update" on public.matching_requests
  for update to authenticated
  using (auth.uid() = student_id)
  with check (auth.uid() = student_id);

-- DELETE celowo bez polityki — usuwanie tylko przez service role (admin/cleanup).

-- ============================================================
-- Trigger: chronione kolumny przy UPDATE wykonanym przez właściciela-studenta
-- ============================================================
create or replace function public.matching_requests_protect_columns()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Aktywne tylko gdy aktualizuje sam właściciel (student). Service role ma
  -- auth.uid() = NULL, więc warunek się nie zmaterializuje i trigger przepuści.
  -- Korepetytor akceptujący zlecenie ma auth.uid() != old.student_id i też
  -- pomija ograniczenia (polityka matching_requests_tutor_accept robi swoją
  -- walidację przez with check).
  if auth.uid() = old.student_id then
    if new.tutor_id is distinct from old.tutor_id then
      raise exception 'Student nie może zmieniać tutor_id na zleceniu';
    end if;
    if new.expires_at is distinct from old.expires_at then
      raise exception 'Student nie może zmieniać expires_at na zleceniu';
    end if;
    if new.student_id is distinct from old.student_id then
      raise exception 'Student nie może zmieniać student_id na zleceniu';
    end if;
    if new.subject_id is distinct from old.subject_id then
      raise exception 'Student nie może zmieniać subject_id na zleceniu';
    end if;
    -- Status: student może tylko anulować swoje zlecenie (cancelled).
    -- Inne przejścia statusu są domeną korepetytora (accepted) lub systemu (completed/expired).
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