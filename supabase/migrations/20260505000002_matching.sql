-- Włącz Realtime dla matching_requests (niezbędne do push notifications w Uber-like flow)
alter publication supabase_realtime add table matching_requests;

-- Korepetytor może odczytać swoje zaakceptowane zlecenia
-- (poprzednia polityka pozwalała tylko na odczyt pending)
create policy "matching_requests_tutor_read_accepted" on matching_requests
  for select to authenticated
  using (
    status = 'accepted'
    and tutor_id = auth.uid()
  );
