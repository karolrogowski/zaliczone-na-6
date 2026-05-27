-- ============================================================
-- ADR-006 §7: Ograniczenie widoczności ocen
-- ============================================================
-- Poprzednia polityka (ratings_read using(true)) dawała wszystkim
-- zalogowanym użytkownikom dostęp do wszystkich ocen.
-- Nowe reguły:
--   • Korepetytor widzi wszystkie oceny ze swoich sesji (własne i od uczniów).
--   • Uczeń widzi wyłącznie oceny, które sam wystawił korepetytorowi
--     (rated_by = 'student', student_id = auth.uid()).
--     Uczeń NIE widzi, jak jest oceniany przez korepetytorów.
--   • Admin używa service role — RLS nie obowiązuje.

drop policy if exists "ratings_read" on public.ratings;

create policy "ratings_read" on public.ratings
  for select to authenticated using (
    -- Korepetytor widzi wszystkie oceny ze swoich sesji
    auth.uid() = tutor_id
    or
    -- Uczeń widzi tylko własne oceny korepetytorów (nie jak korepetytor go ocenił)
    (auth.uid() = student_id and rated_by = 'student')
  );
