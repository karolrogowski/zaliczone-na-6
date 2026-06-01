-- ============================================================
-- Ocena korepetytora → ucznia: usunięcie obowiązku podania score
-- ============================================================
-- Kontekst: korepetytor nie wystawia już oceny 1–5 uczniowi.
-- Jedyne dane po stronie korepetytora to:
--   tutor_preference = 'flag'  (oznaczenie ucznia jako problematycznego)
--   comment                    (prywatna notatka, widoczna tylko temu korepetytorowi)
--
-- Zmiana: score staje się nullable. Oceny uczniów nadal wymagają score
-- (walidacja po stronie aplikacji). Trigger refresh_tutor_rating
-- już ignoruje rated_by = 'tutor', więc NULL score tam nie trafia.
--
-- Backwards-compatible: istniejące wiersze rated_by='tutor' mają score
-- z historycznych ocen — pozostają bez zmian.

alter table public.ratings alter column score drop not null;
