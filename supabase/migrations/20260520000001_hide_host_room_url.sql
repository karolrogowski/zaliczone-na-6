-- [Vuln 5.1] Ukrycie sessions.host_room_url przed studentem.
--
-- Problem: kolumna host_room_url zawiera URL z roomKey Whereby, dający pełne
-- uprawnienia hosta (kick uczestników, koniec sesji). Polityka RLS
-- sessions_participant pozwala czytać wiersz każdemu z uczestników, więc
-- student widział pełny URL hosta swojego korepetytora w odpowiedzi z bazy.
--
-- Rozwiązanie:
--   1. Column-level GRANT — odbieramy table-level SELECT i przyznajemy tylko
--      kolumny niepoufne. Próba `select host_room_url` z konsoli ucznia
--      kończy się permission denied.
--   2. RPC get_session_host_room_url() — SECURITY DEFINER, zwraca URL TYLKO
--      jeśli wywołujący jest korepetytorem przypisanym do tej sesji.

-- ============================================================
-- sessions: ukryj host_room_url
-- ============================================================
revoke select on public.sessions from authenticated;
grant select (
  id, matching_request_id, student_id, tutor_id,
  daily_room_name, daily_room_url,
  status, started_at, ended_at, duration_minutes, notes,
  created_at, updated_at
) on public.sessions to authenticated;

-- ============================================================
-- RPC: get_session_host_room_url
-- ============================================================
create or replace function public.get_session_host_room_url(p_session_id uuid)
returns text
language sql
security definer
set search_path = ''
stable
as $$
  select host_room_url
  from public.sessions
  where id = p_session_id
    and tutor_id = auth.uid();
$$;

grant execute on function public.get_session_host_room_url(uuid) to authenticated;