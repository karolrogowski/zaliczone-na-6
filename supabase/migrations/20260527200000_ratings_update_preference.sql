-- ============================================================
-- Polityka UPDATE na ratings: uczeń może zmieniać własną preferencję
-- ============================================================
-- Problem: removeAvoidPreference() server action wywołuje UPDATE na ratings,
-- ale nie istniała żadna polityka RLS dla UPDATE — operacja była cicho blokowana.
-- Efekt: przycisk "Usuń blokadę" w /settings nie działał (0 rows updated, brak błędu).
--
-- Rozwiązanie: polityka umożliwiająca uczniowi UPDATE własnych ocen wystawionych
-- przez niego (rated_by='student', student_id=auth.uid()).
-- Polityka jest permisywna w zakresie WHICH ROW, ale ograniczona do własnych wierszy.

create policy "ratings_student_update_preference" on public.ratings
  for update to authenticated
  using  (rated_by = 'student' and auth.uid() = student_id)
  with check (rated_by = 'student' and auth.uid() = student_id);
