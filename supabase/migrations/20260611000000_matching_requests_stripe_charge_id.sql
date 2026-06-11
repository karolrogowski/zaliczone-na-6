-- Krok 5 planu płatności (docs/payment-implementation-plan.md):
-- webhook Stripe zapisuje stripe_charge_id przy zdarzeniu charge.captured.
-- Status płatności (stripe_status) żyje na matching_requests przez cały
-- cykl życia preautoryzacji (decyzja z kroku 3) — charge id dołącza do
-- tego samego rekordu. Migracja typu "expand" — nowa nullable kolumna.

alter table matching_requests
  add column stripe_charge_id text unique;
