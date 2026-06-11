-- Krok 3 planu płatności (docs/payment-implementation-plan.md):
-- pola Stripe na matching_requests.
--
-- Preautoryzacja płatności następuje przy złożeniu zlecenia, zanim powstanie
-- sesja — session_financials.session_id wymaga istniejącej sesji (not null,
-- references sessions), więc status PaymentIntent w fazie "zlecenie oczekuje"
-- przechowujemy na matching_requests. Dane trafią do session_financials
-- dopiero gdy sesja powstanie (krok 6).

alter table matching_requests
  add column stripe_payment_intent_id text unique,
  add column stripe_status            text not null default 'pending'
                                       check (stripe_status in
                                         ('pending', 'authorized', 'paid', 'captured',
                                          'cancelled', 'refunded', 'failed'));
