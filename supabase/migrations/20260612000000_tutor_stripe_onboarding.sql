-- Krok 7 planu płatności (docs/payment-implementation-plan.md):
-- onboarding korepetytora przez Stripe Connect Express.
--
-- Migracja typu "expand" — nowa kolumna z wartością domyślną, w pełni
-- backwards-compatible z wdrożonym kodem (ADR-008).
--
-- Kolumna celowo NIE trafia do column-level GRANT z migracji
-- 20260520000000_mass_assignment_fixes.sql — zapis wyłącznie przez
-- service role (domena payments), żeby korepetytor nie mógł sam
-- oznaczyć onboardingu jako ukończonego.

alter table tutor_profiles
  add column stripe_onboarding_done boolean not null default false;
