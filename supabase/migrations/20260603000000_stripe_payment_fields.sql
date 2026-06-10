-- Krok 2 planu płatności (docs/payment-implementation-plan.md):
-- kolumny Stripe w session_financials oraz cena sesji w platform_config.
-- Migracja typu "expand" — wyłącznie nowe, nullable/domyślne kolumny,
-- istniejący kod produkcyjny nie jest tym dotknięty (ADR-008).

alter table session_financials
  add column stripe_payment_intent_id text unique,
  add column stripe_status            text not null default 'pending'
                                       check (stripe_status in
                                         ('pending', 'authorized', 'paid', 'captured',
                                          'cancelled', 'refunded', 'failed')),
  add column stripe_transfer_id       text unique,
  add column stripe_charge_id         text unique;

insert into platform_config (key, value, description) values
  ('session_price_grosz', '10000', 'Cena sesji w groszach (100 zł) — używana do tworzenia PaymentIntent')
on conflict (key) do nothing;
