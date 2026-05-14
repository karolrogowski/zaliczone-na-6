-- Korepetytor może odczytać profil ucznia z jego sesji (potrzebne do /history/[requestId])
create policy "profiles_read_students_in_sessions" on profiles
  for select to authenticated
  using (
    role = 'student'
    and exists (
      select 1 from matching_requests mr
      where mr.student_id = profiles.id
        and mr.tutor_id = auth.uid()
    )
  );