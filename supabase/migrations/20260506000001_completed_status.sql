-- Dodaj status 'completed' do matching_requests
alter table matching_requests drop constraint matching_requests_status_check;
alter table matching_requests add constraint matching_requests_status_check
  check (status in ('pending', 'accepted', 'cancelled', 'expired', 'completed'));

-- Korepetytor widzi też zakończone zlecenia (historia)
drop policy "matching_requests_tutor_read_accepted" on matching_requests;
create policy "matching_requests_tutor_read_accepted" on matching_requests
  for select to authenticated
  using (
    status in ('accepted', 'completed')
    and tutor_id = auth.uid()
  );

-- Korepetytor może zakończyć zaakceptowane zlecenie
create policy "matching_requests_tutor_complete" on matching_requests
  for update to authenticated
  using (
    status = 'accepted'
    and tutor_id = auth.uid()
  )
  with check (
    status = 'completed'
    and tutor_id = auth.uid()
  );
