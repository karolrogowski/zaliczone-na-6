-- Krok 8 planu płatności (docs/payment-implementation-plan.md):
-- podział płatności 70/30 po zakończeniu sesji.
--
-- Migracja typu "expand" — nowa kolumna z wartością domyślną oraz update
-- wartości konfiguracyjnej; backwards-compatible z wdrożonym kodem (ADR-008).

-- Transfer odłożony: korepetytor nie ukończył jeszcze onboardingu Stripe
-- Connect w momencie capture — jego udział zostanie wysłany po podłączeniu
-- konta (flushPendingTransfers).
alter table session_financials
  add column transfer_pending boolean not null default false;

-- Decyzja biznesowa (ADR-008, potwierdzona 2026-06-12): prowizja platformy
-- wynosi 30%. Dotychczasowa wartość 20 była placeholderem nieużywanym przez
-- żaden kod.
update platform_config set value = '30' where key = 'commission_pct';
