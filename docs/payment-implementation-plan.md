# Plan implementacji płatności (Stripe Connect)

Legenda statusów: `TODO` | `IN PROGRESS` | `DONE` | `BLOCKED`

---

## Zakres demo (deadline: 3 dni)

Cel: pokazać działający przepływ pieniędzy w trybie testowym Stripe. Kroki 7–9 (Connect, split, wypłaty) są poza zakresem demo — mogą poczekać.

**Kroki w zakresie demo:** 1, 2, 3, 4, 5, 6 (częściowo), + panel admina z widokiem płatności i przyciskiem refund

**Co demo pokaże:**
- Uczeń wpisuje testową kartę i płaci
- Stripe blokuje 100 zł (preautoryzacja)
- Sesja się odbywa
- Po zakończeniu sesji platforma pobiera 100 zł
- Admin widzi płatność w panelu i może zlecić zwrot

**Co demo pomija (dorobić po demo):**
- Konto bankowe korepetytora (Stripe Connect Express)
- Automatyczny podział 70/30
- Wypłaty korepetytora

---

## Decyzje biznesowe (podjęte 2026-06-08)

| Temat | Decyzja |
|-------|---------|
| Czas trwania sesji | Tylko 60 minut (brak opcji 30 min) |
| Cena sesji | 100 zł — stała, zmieniana przez admina w `platform_config` |
| Timing płatności | Preautoryzacja (hold) przy złożeniu zlecenia; capture po zakończeniu sesji |
| Korepetytor kończy wcześniej | Pobierana pełna kwota (korepetytor nie powinien kończyć wcześniej) |
| Problemy techniczne / reklamacje | Zwrot manualny — admin weryfikuje zgłoszenie i decyduje; bez automatycznych zwrotów |
| Mechanizm zgłaszania problemów | Uczeń wystawia ocenę i/lub kontaktuje się z adminem; admin ma przycisk "Zwróć" w panelu sesji |
| Nadużycia (uczeń kłamie) | Ryzyko akceptowane na tym etapie; admin ocenia wiarygodność zgłoszenia |

---

## Otwarte pytania (wymagają odpowiedzi przed produkcją)

### Prawne / księgowe

- [ ] Czy platforma ma obowiązek wystawiać korepetytorowi PIT-8C od zarobionych kwot?
- [ ] Czy prowizja platformy (30%) podlega VAT? Jak ją fakturować?
- [ ] Jak udokumentować transakcje dla celów podatkowych po stronie platformy?

### Biznesowe

- [ ] Ile czasu ma uczeń na zapłatę po złożeniu zlecenia zanim hold wygaśnie? (Stripe domyślnie 7 dni, ale my pewnie chcemy znacznie mniej — np. 15 minut)
- [ ] Co się dzieje gdy uczeń złoży zlecenie ale nie przejdzie przez formularz płatności? Zlecenie widoczne dla korepetytorów czy nie?
- [ ] Czy korepetytor powinien widzieć, że płatność jest potwierdzona zanim zaakceptuje zlecenie?
- [ ] Prowizja 30% — czy zmienia się w przyszłości (np. niższa dla korepetytorów z wysoką oceną)?

### Produktowe

- [ ] Czy uczeń dostaje email potwierdzający płatność? (Stripe wysyła automatycznie, ale czy chcemy własny email?)
- [ ] Jak informować ucznia o statusie preautoryzacji vs faktycznego pobrania?

---

## Przegląd kroków

| # | Krok | Status | E2E plik |
|---|------|--------|----------|
| 1 | Konfiguracja Stripe — klucze, klient, webhook endpoint | DONE | `e2e/payments-webhook.spec.ts` |
| 2 | Migracja bazy — kolumny Stripe w `session_financials` | DONE | *(db:reset, brak osobnego pliku)* |
| 3 | Backend: tworzenie PaymentIntent przy złożeniu zlecenia | DONE | `e2e/payments-checkout.spec.ts` |
| 4 | UI: formularz płatności Stripe Elements (karta + BLIK) | DONE | `e2e/payments-checkout.spec.ts` |
| 5 | Webhook: `payment_intent.succeeded` → aktualizacja statusu | TODO | `e2e/payments-webhook.spec.ts` |
| 6 | Preautoryzacja: hold → capture po sesji / cancel przy braku korepetytora | TODO | `e2e/payments-capture.spec.ts` |
| 7 | Onboarding korepetytora — Stripe Connect Express | DONE | `e2e/payments-connect.spec.ts` |
| 8 | Split payment — transfer 70% do korepetytora po sesji | DONE | `e2e/payments-connect.spec.ts` |
| 9 | Saldo i wypłata korepetytora | DONE | `e2e/payments-payout.spec.ts` |
| 10 | Zwroty (refund) — akcja adminów | TODO | `e2e/payments-refund.spec.ts` |

---

## Krok 1 — Konfiguracja Stripe: klucze, klient, webhook endpoint

**Status:** DONE

### Zadania implementacyjne

- [x] Zainstaluj pakiety: `npm install stripe @stripe/stripe-js @stripe/react-stripe-js`
- [x] Dodaj zmienne do `.env.local` / `.env.local.example`:
  ```
  STRIPE_SECRET_KEY=sk_test_...
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
  STRIPE_WEBHOOK_SECRET=whsec_...
  ```
- [x] Stwórz `src/domains/payments/stripe-client.ts` — singleton klienta Stripe (server-side)
- [x] Stwórz `src/app/api/webhooks/stripe/route.ts` — endpoint webhooka:
  - Weryfikuje podpis (`stripe.webhooks.constructEvent`)
  - Zwraca 400 przy złym podpisie, 200 przy dobrym
  - Na razie tylko loguje zdarzenia (logika w kolejnych krokach)
- [x] Stwórz `src/domains/payments/` — nowa domena z plikami: `types.ts` (gotowe), `queries.ts` i `actions.ts` (w kroku 3)

### E2E testy: `e2e/payments-webhook.spec.ts`

- [x] **Test 1:** Endpoint `/api/webhooks/stripe` odrzuca żądania bez podpisu (HTTP 400) — PASS
- [x] **Test 2:** Endpoint odrzuca żądania z nieprawidłowym podpisem (HTTP 400) — PASS
- [x] **Test 3:** Symulacja zdarzenia z poprawnym podpisem (`Stripe.webhooks.generateTestHeaderString`) → endpoint odpowiada 200 — PASS

### Konfiguracja środowiska (wykonane 2026-06-08)

- Klucze testowe Stripe dodane do `.env.local` (`STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`)
- Stripe CLI zainstalowane (`winget install Stripe.StripeCli`)
- `stripe listen --forward-to localhost:3000/api/webhooks/stripe` uruchomione w tle — webhook signing secret zapisany jako `STRIPE_WEBHOOK_SECRET`

> Uwaga: `stripe listen` musi działać w tle przez cały czas developmentu płatności — przekierowuje zdarzenia ze Stripe (test mode) na lokalny endpoint webhooka. Jeśli zostanie zatrzymane, webhooki przestaną docierać (testy E2E nadal przejdą — generują własne podpisane payloady niezależnie od `stripe listen`).

---

## Krok 2 — Migracja bazy: kolumny Stripe w `session_financials`

**Status:** DONE

### Zadania implementacyjne

- [x] Stwórz migrację `supabase/migrations/20260603000000_stripe_payment_fields.sql`:
  ```sql
  alter table session_financials
    add column stripe_payment_intent_id text unique,
    add column stripe_status            text not null default 'pending'
                                        check (stripe_status in
                                          ('pending','authorized','paid','captured',
                                           'cancelled','refunded','failed')),
    add column stripe_transfer_id       text unique,
    add column stripe_charge_id         text unique;
  ```
- [x] Dodaj cenę sesji do `platform_config`: `session_price_grosz = 10000` (100 zł)
- [x] Pole na konto korepetytora — pominięte: `tutor_profiles.stripe_account_id` już istnieje w schemacie (initial_schema). `stripe_onboarding_done` zostanie dodany dopiero w kroku 7 (Connect onboarding, poza zakresem demo).
- [x] Polityki RLS — bez zmian, nowe kolumny dziedziczą istniejące polityki SELECT na `session_financials`; zapis odbywa się przez service role / definer functions (poza RLS)

### Weryfikacja

- [x] `npm run db:reset` — przechodzi bez błędów
- [x] `npx tsc --noEmit` — brak błędów typów

> Brak osobnego pliku E2E dla tego kroku — weryfikacja przez `db:reset` i kolejne testy, które czytają nowe kolumny.

---

## Krok 3 — Backend: tworzenie PaymentIntent przy złożeniu zlecenia

**Status:** DONE

### Zadania implementacyjne

- [x] Stwórz server action `createCheckoutSession(requestId)` w `src/domains/payments/actions.ts`:
  - Pobiera zlecenie z DB (czas trwania → kwota)
  - Tworzy `PaymentIntent` w Stripe z `capture_method: 'manual'` (preautoryzacja)
  - Zapisuje `stripe_payment_intent_id` i `stripe_status: 'pending'` do `matching_requests`
  - Zwraca `clientSecret` do frontendu
- [x] Kwota (w groszach): 100 zł (10000 gr) za sesję 60 min — konfigurowalne w `platform_config`
- [x] Stwórz `src/domains/payments/queries.ts` — zapytania o cenę sesji z `platform_config`

**Decyzja architektoniczna:** pola Stripe (`stripe_payment_intent_id`, `stripe_status`) zostały dodane
do `matching_requests` (migracja `20260605000000_payment_fields_matching_requests.sql`), a nie do
`session_financials` jak pierwotnie planowano — `session_financials` powstaje dopiero przy akceptacji
zlecenia przez korepetytora, a PaymentIntent musi istnieć już w momencie złożenia zlecenia (krok
preautoryzacji następuje przed matchingiem).

### E2E testy: `e2e/payments-checkout.spec.ts` (pierwsza część)

- [x] **Test 1:** Złożenie zlecenia przez ucznia tworzy `PaymentIntent` (`stripe_payment_intent_id` zaczyna się od `pi_`, `stripe_status = 'pending'`) i przekierowuje na `/checkout/[requestId]`
- [x] **Test 2:** Próba wejścia na checkout cudzego zlecenia → redirect na `/dashboard`

---

## Krok 4 — UI: formularz płatności Stripe Elements (karta + BLIK)

**Status:** DONE

### Zadania implementacyjne

- [x] Stwórz stronę `src/app/(app)/checkout/[requestId]/page.tsx`:
  - Server component pobiera `clientSecret` (wywołując akcję z kroku 3)
  - Przekazuje `clientSecret` do client component
- [x] Stwórz `src/app/(app)/checkout/[requestId]/CheckoutForm.tsx` (client component):
  - `<Elements stripe={stripePromise} options={{ clientSecret }}>` jako wrapper
  - `<PaymentElement />` — gotowy komponent Stripe (obsługuje kartę + BLIK automatycznie)
  - Przycisk "Zapłać" → `stripe.confirmPayment()` → redirect na `/dashboard?payment=success`
- [x] Stwórz stronę powrotu `src/app/(app)/dashboard` — wyświetla zielony baner gdy `?payment=success`
- [x] Dodaj przekierowanie na checkout w przepływie: po złożeniu zlecenia przez ucznia → `/checkout/[requestId]`
- [x] CSP (`next.config.ts`): dodano `https://js.stripe.com` do `script-src`/`frame-src` i
  `https://api.stripe.com` do `connect-src` — bez tego Stripe.js był blokowany przez przeglądarkę.

### E2E testy: `e2e/payments-checkout.spec.ts` (druga część)

- [x] **Test 3:** Uczeń wpisuje testową kartę `4242 4242 4242 4242`, klika "Zapłać" → trafia na dashboard z banerem "Płatność zaakceptowana"
- [x] **Test 4:** Uczeń wpisuje kartę odrzuconą `4000 0000 0000 9995` → widoczny komunikat o odrzuceniu w formularzu Stripe, pozostaje na `/checkout/...`

---

## Krok 5 — Webhook: `payment_intent.succeeded` → aktualizacja statusu

**Status:** DONE

### Zadania implementacyjne

- [x] Rozbuduj endpoint `src/app/api/webhooks/stripe/route.ts` o obsługę zdarzenia `payment_intent.payment_failed` i `charge.captured`:
  - `payment_intent.succeeded` (dla płatności bez preautoryzacji — fallback): `stripe_status = 'paid'`
  - `payment_intent.amount_capturable_updated` (preautoryzacja gotowa): `stripe_status = 'authorized'`
  - `charge.captured`: `stripe_status = 'captured'`, zapisz `stripe_charge_id`
  - `payment_intent.payment_failed`: `stripe_status = 'failed'`
  - `payment_intent.canceled`: `stripe_status = 'cancelled'`
- [x] Webhook szuka rekordu w `matching_requests` po `stripe_payment_intent_id` i aktualizuje status (zgodnie z decyzją z kroku 3 — `matching_requests` jest źródłem prawdy dla statusu płatności przez cały cykl życia preautoryzacji; `session_financials` pozostaje bez logiki, poza zakresem)
- [x] Użyj klienta Supabase z service role — nowy `src/domains/payments/service-client.ts` (analogiczny do `shared/supabase/admin.ts`, ale w domenie `payments`, zgodnie z konwencją że `admin.ts` jest zarezerwowany dla domeny `admin/`)
- [x] Migracja `20260611000000_matching_requests_stripe_charge_id.sql` — nowa nullable kolumna `stripe_charge_id` na `matching_requests`
- [x] Zabezpieczenie przed cofnięciem statusu przez spóźnione zdarzenie (`STATUS_RANK`) — np. spóźniony `amount_capturable_updated` po `charge.captured` nie cofa statusu z `'captured'` do `'authorized'`

### E2E testy: `e2e/payments-webhook.spec.ts` (rozszerzenie)

- [x] **Test 3:** Symulacja `payment_intent.amount_capturable_updated` przez HTTP POST z testowym payloadem → `matching_requests.stripe_status` zmienia się na `'authorized'`
- [x] **Test 4:** Symulacja `payment_intent.payment_failed` → `stripe_status = 'failed'`
- [x] **Test 5:** `charge.captured` ustawia `stripe_status = 'captured'` i `stripe_charge_id`; spóźnione zdarzenie `amount_capturable_updated` po nim nie cofa statusu (idempotencja)

---

## Krok 6 — Preautoryzacja: capture po sesji, cancel przy braku korepetytora

**Status:** DONE

### Zadania implementacyjne

- [x] Stwórz wspólny moduł `src/domains/payments/status.ts` z `STATUS_RANK` i `updatePaymentStatus()` (wydzielone z webhooka, używane też przez capture/cancel)
- [x] Stwórz server action `capturePayment(requestId)` w `src/domains/payments/actions.ts`:
  - Pobiera `stripe_payment_intent_id` i `stripe_status` z `matching_requests`
  - Idempotentne — działa tylko gdy status to `pending`/`authorized`
  - Wywołuje `stripe.paymentIntents.capture(paymentIntentId)`
  - Aktualizuje `stripe_status = 'captured'` i `stripe_charge_id`
- [x] Stwórz server action `cancelPaymentHold(requestId)`:
  - Wywołuje `stripe.paymentIntents.cancel(paymentIntentId)`
  - Aktualizuje `stripe_status = 'cancelled'`
- [x] Stwórz server action `cancelExpiredPaymentHolds()` — anuluje preautoryzacje dla zleceń `pending` z minionym `expires_at`
- [x] Podepnij `capturePayment` do `completeSession` (`src/domains/sessions/actions.ts`)
- [x] Podepnij `cancelPaymentHold` do `cancelMatchingRequest` (`src/domains/matching/actions.ts`)
- [x] Podepnij `cancelExpiredPaymentHolds` jako lazy-expiry housekeeping w `getTutorPendingRequests` (`src/domains/matching/queries.ts`)

### E2E testy: `e2e/payments-capture.spec.ts`

- [x] **Test 1:** Uczeń anuluje zlecenie z aktywną preautoryzacją → `cancelPaymentHold` → `stripe_status = 'cancelled'`, PaymentIntent `canceled` w Stripe
- [x] **Test 2:** Korepetytor kończy sesję z preautoryzowaną płatnością → `capturePayment` → zlecenie `completed`, `stripe_status = 'captured'`, `stripe_charge_id` ustawiony, PaymentIntent `succeeded` w Stripe
- [x] **Test 3:** Zlecenie `pending` z minionym `expires_at` → wizyta korepetytora na dashboardzie uruchamia `cancelExpiredPaymentHolds` → zlecenie `expired`, `stripe_status = 'cancelled'`, PaymentIntent `canceled` w Stripe

---

## Krok 7 — Onboarding korepetytora: Stripe Connect Express

**Status:** DONE

### Zadania implementacyjne

- [x] Server action `startConnectOnboarding()` (`src/domains/payments/actions.ts`):
  - Tworzy Express connected account: `stripe.accounts.create({ type: 'express', country: 'PL', capabilities: { transfers } })`
  - Zapisuje `stripe_account_id` w `tutor_profiles` (kolumna istniała od initial schema; zapis przez service role — kolumna chroniona przed mass assignment)
  - Tworzy link onboardingowy: `stripe.accountLinks.create(...)` z `return_url` i `refresh_url` (origin z `NEXT_PUBLIC_SITE_URL` lub nagłówków)
  - Zwraca URL do redirectu
- [x] Migracja `20260612000000_tutor_stripe_onboarding.sql` — `tutor_profiles.stripe_onboarding_done boolean not null default false` (expand, zapis tylko service role)
- [x] Strona `src/app/(app)/settings/stripe/return/page.tsx`:
  - `syncConnectOnboardingStatus()` pobiera konto ze Stripe; gdy `details_submitted && payouts_enabled` → `stripe_onboarding_done = true` (dla kont transfer-only właściwy jest `payouts_enabled`, nie `charges_enabled`)
  - W przeciwnym razie komunikat "Stripe wymaga dodatkowych informacji" z linkiem do refresh
- [x] Strona `src/app/(app)/settings/stripe/refresh/page.tsx` — generuje nowy link onboardingowy i redirectuje
- [x] Sekcja "Konto bankowe" w ustawieniach (`BankAccountSection`, domena payments):
  - Bez onboardingu: przycisk "Połącz konto bankowe" / "Dokończ konfigurację konta"
  - Po onboardingu: "✓ Konto podłączone" + przycisk do panelu Stripe Express (login link)
- [x] Ostrzeżenie na dashboardzie korepetytora bez onboardingu ("Podłącz konto bankowe w Ustawieniach…")

**Decyzja (zmiana wobec pierwotnego planu):** korepetytor bez ukończonego onboardingu **może** przyjmować zlecenia — jego udział jest odkładany (`transfer_pending`, krok 8) i wysyłany po podłączeniu konta. Twarda blokada akceptacji odcinałaby podaż korepetytorów na starcie.

### E2E testy: `e2e/payments-connect.spec.ts`

Wymaga aktywowanego Stripe Connect na platformowym koncie testowym (jednorazowo w dashboardzie) — sonda w `beforeAll` pomija testy z komunikatem, gdy Connect nieaktywny. Pełne przejście hostowanego formularza Stripe nie jest automatyzowane (zewnętrzny UI) — pozytywna ścieżka return-page weryfikowana manualnie w test mode.

- [x] **Test 1:** Korepetytor bez konta Stripe widzi przycisk "Połącz konto bankowe" w ustawieniach
- [x] **Test 2:** Kliknięcie przycisku tworzy `stripe_account_id` (`acct_…`) w DB i redirectuje na `connect.stripe.com`
- [x] **Test 3:** Powrót na `/settings/stripe/return` z niekompletnym kontem → komunikat o dokończeniu konfiguracji, `stripe_onboarding_done` pozostaje `false`
- [x] **Test 4:** Przy `stripe_onboarding_done = true` ustawienia pokazują "Konto podłączone" + przycisk panelu wypłat
- [x] **Test 5:** Korepetytor bez onboardingu widzi ostrzeżenie na dashboardzie

---

## Krok 8 — Split payment: transfer 70% do korepetytora po sesji

**Status:** DONE

### Zadania implementacyjne

- [x] Migracja `20260612000001_split_payment_fields.sql` — `session_financials.transfer_pending` (expand) + `commission_pct = 30` (decyzja ADR-008; wcześniejsza wartość 20 była nieużywanym placeholderem)
- [x] Rozbudowane `capturePayment(requestId)` z kroku 6 (`recordFinancialsAndTransfer`):
  - Po udanym capture: prowizja czytana z `platform_config.commission_pct` (admin może ją zmieniać w panelu), podział `floor(kwota * (100 - pct) / 100)`
  - Transfer: `stripe.transfers.create({ amount, currency: 'pln', destination, source_transaction: chargeId })` — `source_transaction` wiąże transfer z konkretną płatnością
  - Wiersz `session_financials` zapisywany przy każdym capture (student_cost / tutor_earning / commission / stripe_*); idempotentnie po `unique(session_id)`
- [x] Korepetytor bez ukończonego onboardingu: `transfer_pending = true`; `flushPendingTransfers()` wysyła zaległe transfery po powrocie z onboardingu (`syncConnectOnboardingStatus`)
- [x] RLS — bez zmian: istniejąca polityka `session_financials_tutor` (SELECT całego wiersza) pokrywa odczyt `stripe_transfer_id`
- [x] Zwrot (rozszerzenie kroku 10): `refundSession` po `refunds.create` wykonuje `transfers.createReversal` gdy transfer został wysłany, ustawia `session_financials.stripe_status = 'refunded'` i `transfer_pending = false` (zwrócona sesja nie może zostać później dopłacona przez flush); wynik reversal w audit logu (`payload.transfer_reversed`)

### E2E testy: `e2e/payments-connect.spec.ts` (rozszerzenie)

Konto Connect dla weryfikacji transferów tworzone jako `type: 'custom'` aktywowane w całości przez API (Express nie da się ukończyć bez hostowanego formularza Stripe); transfery działają identycznie.

- [x] **Test 6:** Pełny przepływ: capture po sesji → `stripe_transfer_id` w `session_financials`, podział 7000/3000 gr, kwota transferu zweryfikowana w Stripe API (= 70%)
- [x] **Test 7:** Korepetytor bez onboardingu: `transfer_pending = true` po capture; po powrocie z onboardingu (`/settings/stripe/return`) zaległy transfer wysłany

---

## Krok 9 — Saldo i wypłata korepetytora

**Status:** DONE

### Zadania implementacyjne

- [x] Query `getTutorBalance()` (`src/domains/payments/queries.ts`):
  - `stripe.balance.retrieve({}, { stripeAccount })` — dostępne + oczekujące saldo PLN w groszach; `null` bez ukończonego onboardingu
- [x] Query `getTutorEarningsHistory()` — historia zarobków z `session_financials` (RLS: korepetytor czyta wiersze swoich sesji), z odznaką "oczekuje na konto bankowe" dla `transfer_pending`
- [x] Server action `requestPayout()` — wypłaca całe dostępne saldo PLN (`stripe.payouts.create(..., { stripeAccount })`); błąd przy saldzie 0
- [x] Konta Connect tworzone z **ręcznym harmonogramem wypłat** (`settings.payouts.schedule.interval = 'manual'`) — domyślny automatyczny harmonogram Express blokowałby ręczne `payouts.create`
- [x] Sekcja "Zarobki" w ustawieniach korepetytora (`EarningsSection`, widoczna po onboardingu): dostępne / oczekujące saldo, przycisk "Wypłać na konto bankowe" (disabled przy 0), historia ostatnich sesji

### E2E testy: `e2e/payments-payout.spec.ts`

Saldo konta Connect zasilane transferem przez Stripe API (platforma finansowana kartą `pm_card_bypassPending`). Gating na aktywny Connect jak w `payments-connect.spec.ts`.

- [x] **Test 1:** Korepetytor z `stripe_onboarding_done = true` widzi sekcję "Zarobki" z saldem i przyciskiem wypłaty
- [x] **Test 2:** Po transferze saldo dostępne = 70,00 zł; kliknięcie "Wypłać" → komunikat sukcesu, payout 7000 gr widoczny w Stripe API
- [x] **Test 3:** Przy zerowym saldzie przycisk wypłaty nieaktywny
- [x] **Test 4:** Korepetytor bez onboardingu nie widzi sekcji "Zarobki"

---

## Krok 10 — Zwroty (refund): akcja administracyjna

**Status:** DONE

### Zadania implementacyjne

- [x] Stwórz server action `refundSession(requestId, reason?)` w `src/domains/admin/actions.ts`:
  - Wymaga roli admin (`requireAdminSession`, aal2)
  - Pobiera `stripe_status`/`stripe_charge_id` z `matching_requests` (źródło prawdy — nie `session_financials`)
  - Działa tylko gdy `stripe_status === 'captured'`, w przeciwnym razie zwraca błąd
  - Wywołuje `stripe.refunds.create({ charge: chargeId, reason })`
  - Aktualizuje `stripe_status = 'refunded'` w `matching_requests`
  - Dodaje wpis do `admin_audit_log` (`session_payment_refunded`)
- [x] Dodaj przycisk "Zwróć płatność" / odznakę "Zwrócono" w panelu admina (`SessionsTable`, kolumna "Płatność")
- [x] Dodaj informację o zwrocie w historii sesji ucznia (`/history/[requestId]` — baner "Płatność za tę sesję została zwrócona.")

### E2E testy: `e2e/payments-refund.spec.ts`

Pełny przepływ admina (przyciski w panelu, wywołanie `refundSession`, wpis audytowy) wymaga
zalogowanego administratora z aal2 (TOTP) — środowisko testowe nie ma skonfigurowanego konta
admina z MFA (to samo ograniczenie co przy teście `updateCommissionPct` w `security.spec.ts`).
Pokryto testami część dostępną przez UI zwykłego użytkownika:

- [x] **Test 1:** Uczeń próbujący wejść na `/admin/sessions` (skąd dostępny jest zwrot) zostaje przekierowany na `/dashboard`
- [x] **Test 2:** Uczeń widzi w historii sesji baner o zwrocie dla `stripe_status = 'refunded'`
- [x] **Test 3:** Uczeń nie widzi banera o zwrocie dla sesji z `stripe_status = 'captured'`

---

## Zależności między krokami

```
Krok 1 (konfiguracja)
  └─► Krok 2 (migracja)
        └─► Krok 3 (backend PI)
              └─► Krok 4 (UI formularz)
                    └─► Krok 5 (webhook status)
                          └─► Krok 6 (capture/cancel)
                                ├─► Krok 7 (onboarding korepetytora)
                                │     └─► Krok 8 (split payment)
                                │           └─► Krok 9 (saldo/wypłata)
                                └─► Krok 10 (refund) ← można równolegle z 7-9
```

Kroki 1–6 to fundament — zablokują wszystko poniżej.
Krok 7–9 to przepływ korepetytora — można zacząć od kroku 7 zaraz po kroku 2 (onboarding nie zależy od formularza płatności).
Krok 10 (refund) można zrobić w dowolnym momencie po kroku 6.

---

## Zmienne środowiskowe (checklista przed startem)

| Zmienna | Gdzie | Opis |
|---------|-------|------|
| `STRIPE_SECRET_KEY` | `.env.local` (serwer) | `sk_test_...` w dev, `sk_live_...` na prod |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `.env.local` (klient) | `pk_test_...` w dev |
| `STRIPE_WEBHOOK_SECRET` | `.env.local` (serwer) | `whsec_...` z `stripe listen` w dev |

W CI/CD (Vercel): dodaj jako Environment Variables w panelu projektu (oddzielne wartości dla Preview i Production).
