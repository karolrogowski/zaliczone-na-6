-- ============================================================
-- Sessions: daily_room_* nullable do czasu integracji Daily.co
-- ============================================================
alter table sessions alter column daily_room_name drop not null;
alter table sessions alter column daily_room_url  drop not null;

-- Korepetytor tworzy sesję przy akceptacji zlecenia
create policy "sessions_insert_tutor" on sessions
  for insert to authenticated
  with check (tutor_id = auth.uid());

-- Uczestnik (uczeń lub korepetytor) może zakończyć/anulować sesję
create policy "sessions_update_participant" on sessions
  for update to authenticated
  using (auth.uid() = student_id or auth.uid() = tutor_id);

-- ============================================================
-- Auto-expiry: funkcja wywoływana lazy (+ opcjonalnie pg_cron)
-- ============================================================
create or replace function expire_pending_requests()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.matching_requests
  set status = 'expired'
  where status = 'pending'
    and expires_at < now();
$$;
