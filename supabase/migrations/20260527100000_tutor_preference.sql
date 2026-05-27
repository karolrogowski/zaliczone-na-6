-- ============================================================
-- Preferencja korepetytora dotycząca ucznia
-- ============================================================
-- flag: uczeń był problematyczny. Przy kolejnych zleceniach od tego
-- ucznia korepetytor zobaczy ostrzeżenie w karcie zlecenia.
-- Kolumna jest null dla ocen wystawianych przez uczniów (rated_by = 'student').
-- RLS: korepetytor czyta tylko własne wiersze (tutor_id = auth.uid()),
-- więc flaga nie jest widoczna dla ucznia.

alter table public.ratings
  add column tutor_preference text
  check (tutor_preference in ('flag'));
