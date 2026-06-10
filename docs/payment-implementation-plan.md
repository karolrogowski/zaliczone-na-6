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
| 3 | Backend: tworzenie PaymentIntent przy złożeniu zlecenia | TODO | `e2e/payments-checkout.spec.ts` |
| 4 | UI: formularz płatności Stripe Elements (karta + BLIK) | TODO | `e2e/payments-checkout.spec.ts` |
| 5 | Webhook: `payment_intent.succeeded` → aktualizacja statusu | TODO | `e2e/payments-webhook.spec.ts` |
| 6 | Preautoryzacja: hold → capture po sesji / cancel przy braku korepetytora | TODO | `e2e/payments-capture.spec.ts` |
| 7 | Onboarding korepetytora — Stripe Connect Express | TODO | `e2e/payments-connect.spec.ts` |
| 8 | Split payment — transfer 70% do korepetytora po sesji | TODO | `e2e/payments-connect.spec.ts` |
| 9 | Saldo i wypłata korepetytora | TODO | `e2e/payments-payout.spec.ts` |
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

**Status:** TODO

### Zadania implementacyjne

- [ ] Stwórz server action `createCheckoutSession(requestId)` w `src/domains/payments/actions.ts`:
  - Pobiera zlecenie z DB (czas trwania → kwota)
  - Tworzy `PaymentIntent` w Stripe z `capture_method: 'manual'` (preautoryzacja)
  - Zapisuje `stripe_payment_intent_id` i `stripe_status: 'pending'` do `session_financials`
  - Zwraca `clientSecret` do frontendu
- [ ] Kwota (w groszach): 30 min = 8000 gr (80 zł), 60 min = 14000 gr (140 zł) — konfigurowalne w `platform_config`
- [ ] Stwórz `src/domains/payments/queries.ts` — zapytania do `session_financials`

### E2E testy: `e2e/payments-checkout.spec.ts` (pierwsza część)

- [ ] **Test 1:** Zalogowany uczeń wywołuje `createCheckoutSession` dla istniejącego zlecenia → w odpowiedzi jest `clientSecret` (zaczyna się od `pi_...`)
- [ ] **Test 2:** Wywołanie dla cudzego zlecenia zwraca błąd autoryzacji
- [ ] **Test 3:** `session_financials` ma rekord z `stripe_status = 'pending'` po wywołaniu akcji

---

## Krok 4 — UI: formularz płatności Stripe Elements (karta + BLIK)

**Status:** TODO

### Zadania implementacyjne

- [ ] Stwórz stronę `src/app/(app)/checkout/[requestId]/page.tsx`:
  - Server component pobiera `clientSecret` (wywołując akcję z kroku 3)
  - Przekazuje `clientSecret` do client component
- [ ] Stwórz `src/app/(app)/checkout/[requestId]/CheckoutForm.tsx` (client component):
  - `<Elements stripe={stripePromise} options={{ clientSecret }}>` jako wrapper
  - `<PaymentElement />` — gotowy komponent Stripe (obsługuje kartę + BLIK automatycznie)
  - Przycisk "Zapłać" → `stripe.confirmPayment()` → redirect na `/dashboard?payment=success`
- [ ] Stwórz stronę powrotu `src/app/(app)/dashboard` — wyświetla zielony baner gdy `?payment=success`
- [ ] Dodaj przekierowanie na checkout w przepływie: po złożeniu zlecenia przez ucznia → `/checkout/[requestId]`

### E2E testy: `e2e/payments-checkout.spec.ts` (druga część)

- [ ] **Test 4:** Uczeń widzi stronę `/checkout/[requestId]` z formularzem płatności
- [ ] **Test 5:** Uczeń wpisuje testową kartę `4242 4242 4242 4242`, klika "Zapłać" → trafia na dashboard z banerem sukcesu
- [ ] **Test 6:** Uczeń wpisuje kartę odrzuconą `4000 0000 0000 9995` → widzi komunikat błędu na stronie (nie redirect)
- [ ] **Test 7:** Próba dostępu do cudzego checkoutu → redirect na dashboard

---

## Krok 5 — Webhook: `payment_intent.succeeded` → aktualizacja statusu

**Status:** TODO

### Zadania implementacyjne

- [ ] Rozbuduj endpoint `src/app/api/webhooks/stripe/route.ts` o obsługę zdarzenia `payment_intent.payment_failed` i `charge.captured`:
  - `payment_intent.succeeded` (dla płatności bez preautoryzacji — fallback): `stripe_status = 'paid'`
  - `payment_intent.amount_capturable_updated` (preautoryzacja gotowa): `stripe_status = 'authorized'`
  - `charge.captured`: `stripe_status = 'captured'`, zapisz `stripe_charge_id`
  - `payment_intent.payment_failed`: `stripe_status = 'failed'`
  - `payment_intent.canceled`: `stripe_status = 'cancelled'`
- [ ] Webhook szuka rekordu w `session_financials` po `stripe_payment_intent_id` i aktualizuje status
- [ ] Użyj klienta Supabase z service role (admin) — webhook nie ma sesji użytkownika

### E2E testy: `e2e/payments-webhook.spec.ts` (rozszerzenie)

- [ ] **Test 3:** Symulacja `payment_intent.amount_capturable_updated` przez HTTP POST z testowym payloadem → `session_financials.stripe_status` zmienia się na `'authorized'`
- [ ] **Test 4:** Symulacja `payment_intent.payment_failed` → `stripe_status = 'failed'`
- [ ] **Test 5:** Podwójne dostarczenie tego samego zdarzenia (idempotencja) → endpoint zwraca 200, status nie zmienia się na gorsze

---

## Krok 6 — Preautoryzacja: capture po sesji, cancel przy braku korepetytora

**Status:** TODO

### Zadania implementacyjne

- [ ] Stwórz server action `capturePayment(sessionId)`:
  - Pobiera `stripe_payment_intent_id` z `session_financials`
  - Wywołuje `stripe.paymentIntents.capture(paymentIntentId)`
  - Aktualizuje `stripe_status = 'captured'`
- [ ] Stwórz server action `cancelPaymentHold(requestId)`:
  - Wywołuje `stripe.paymentIntents.cancel(paymentIntentId)`
  - Aktualizuje `stripe_status = 'cancelled'`
- [ ] Podepnij `capturePayment` do istniejącej akcji kończącej sesję (`src/domains/sessions/actions.ts` — funkcja która wywołuje się gdy korepetytor kończy sesję)
- [ ] Podepnij `cancelPaymentHold` do akcji wygasania zlecenia (gdy nikt nie zaakceptował w czasie X)

### E2E testy: `e2e/payments-capture.spec.ts`

- [ ] **Test 1:** Pełny przepływ: uczeń płaci (testowa karta) → korepetytor akceptuje → sesja → korepetytor kończy → `stripe_status = 'captured'` w DB
- [ ] **Test 2:** Uczeń płaci → nikt nie akceptuje zlecenia w ciągu X minut → hold anulowany → `stripe_status = 'cancelled'`
- [ ] **Test 3:** Próba double-capture (wywołanie akcji dwa razy) → druga próba zwraca błąd, status pozostaje `'captured'`

---

## Krok 7 — Onboarding korepetytora: Stripe Connect Express

**Status:** TODO

### Zadania implementacyjne

- [ ] Stwórz server action `startConnectOnboarding()`:
  - Tworzy Express connected account: `stripe.accounts.create({ type: 'express', country: 'PL', ... })`
  - Zapisuje `stripe_account_id` w `profiles`
  - Tworzy link onboardingowy: `stripe.accountLinks.create(...)` z `return_url` i `refresh_url`
  - Zwraca URL do redirectu
- [ ] Stwórz stronę `src/app/(app)/settings/stripe/return/page.tsx`:
  - Pobiera aktualny status konta z Stripe API
  - Jeśli `charges_enabled: true` → ustawia `stripe_onboarding_done = true` w DB → pokazuje sukces
  - Jeśli nie → pokazuje komunikat "wymagane dodatkowe informacje" z linkiem do odświeżenia
- [ ] Stwórz stronę `src/app/(app)/settings/stripe/refresh/page.tsx`:
  - Generuje nowy link onboardingowy i redirectuje
- [ ] Dodaj sekcję "Konto bankowe" w `src/app/(app)/settings/page.tsx`:
  - Jeśli `stripe_onboarding_done = false`: przycisk "Połącz konto bankowe" → wywołuje akcję → redirect na Stripe
  - Jeśli `stripe_onboarding_done = true`: "Konto podłączone ✓" + link do Stripe Express dashboard

### E2E testy: `e2e/payments-connect.spec.ts`

- [ ] **Test 1:** Korepetytor bez konta Stripe widzi przycisk "Połącz konto bankowe" w ustawieniach
- [ ] **Test 2:** Kliknięcie przycisku tworzy `stripe_account_id` w DB i redirectuje na Stripe (w teście: sprawdź redirect URL zaczyna się od `https://connect.stripe.com`)
- [ ] **Test 3:** Po symulacji powrotu z onboardingu (`/settings/stripe/return?account=acct_test...`) — `stripe_onboarding_done = true` w DB, UI pokazuje "Konto podłączone"
- [ ] **Test 4:** Korepetytor bez zakończonego onboardingu nie może przyjąć sesji — wyświetla się ostrzeżenie

---

## Krok 8 — Split payment: transfer 70% do korepetytora po sesji

**Status:** TODO

### Zadania implementacyjne

- [ ] Rozbuduj `capturePayment(sessionId)` z kroku 6:
  - Po udanym capture: pobierz `stripe_account_id` korepetytora z `profiles`
  - Stwórz transfer: `stripe.transfers.create({ amount: tutor_earning_grosz, currency: 'pln', destination: stripe_account_id })`
  - Zapisz `stripe_transfer_id` w `session_financials`
- [ ] Obsłuż przypadek gdy korepetytor nie ma jeszcze konta Stripe (nie zrobił onboardingu):
  - Transfer odłożony — dodaj flagę `transfer_pending = true` w `session_financials`
  - Po zakończeniu onboardingu przez korepetytora: wyślij zaległe transfery
- [ ] Dodaj RLS: korepetytor może czytać swój `stripe_transfer_id` z `session_financials`

### E2E testy: `e2e/payments-connect.spec.ts` (rozszerzenie)

- [ ] **Test 5:** Pełny przepływ z Connect: uczeń płaci → sesja → capture → `stripe_transfer_id` pojawia się w `session_financials`
- [ ] **Test 6:** Korepetytor bez onboardingu: `transfer_pending = true` po capture; po zakończeniu onboardingu transfer zostaje wysłany
- [ ] **Test 7:** Kwota transferu = 70% kwoty sesji (sprawdź w Stripe test API)

---

## Krok 9 — Saldo i wypłata korepetytora

**Status:** TODO

### Zadania implementacyjne

- [ ] Stwórz server action `getTutorBalance()`:
  - Pobiera `stripe_account_id` z profilu
  - Wywołuje `stripe.balance.retrieve({ stripeAccount: accountId })`
  - Zwraca dostępne saldo w groszach + oczekujące
- [ ] Stwórz server action `requestPayout()`:
  - Wywołuje `stripe.payouts.create({ currency: 'pln', method: 'standard' }, { stripeAccount: accountId })`
  - Zwraca status wypłaty
- [ ] Dodaj sekcję "Zarobki" w ustawieniach korepetytora:
  - Dostępne saldo (przeliczone na zł)
  - Oczekujące (jeszcze nie rozliczone przez Stripe)
  - Przycisk "Wypłać na konto bankowe" (aktywny gdy saldo > 0)
  - Historia ostatnich sesji z kwotami (z `session_financials`)

### E2E testy: `e2e/payments-payout.spec.ts`

- [ ] **Test 1:** Korepetytor z `stripe_onboarding_done = true` widzi sekcję "Zarobki" w ustawieniach
- [ ] **Test 2:** Po zakończonej sesji (krok 8) saldo korepetytora > 0
- [ ] **Test 3:** Kliknięcie "Wypłać" z dostępnym saldem → komunikat sukcesu, Stripe tworzy payout w test mode
- [ ] **Test 4:** Kliknięcie "Wypłać" przy zerowym saldzie → przycisk nieaktywny lub komunikat "brak środków"
- [ ] **Test 5:** Korepetytor bez zakończonego onboardingu nie widzi sekcji salda

---

## Krok 10 — Zwroty (refund): akcja administracyjna

**Status:** TODO

### Zadania implementacyjne

- [ ] Stwórz server action `refundSession(sessionId, reason?)` w `src/domains/admin/actions.ts`:
  - Wymaga roli admin
  - Pobiera `stripe_charge_id` z `session_financials`
  - Wywołuje `stripe.refunds.create({ charge: chargeId, reason: 'fraudulent' | 'requested_by_customer' | 'duplicate' })`
  - Aktualizuje `stripe_status = 'refunded'` w `session_financials`
  - Dodaje wpis do `admin_audit_log`
- [ ] Dodaj przycisk "Zwróć płatność" w panelu admina przy szczegółach sesji (`src/app/admin/(panel)/sessions/page.tsx`)
- [ ] Dodaj informację o zwrocie w historii sesji ucznia (uczeń widzi "Płatność zwrócona")

### E2E testy: `e2e/payments-refund.spec.ts`

- [ ] **Test 1:** Admin widzi przycisk "Zwróć płatność" przy sesji z `stripe_status = 'captured'`
- [ ] **Test 2:** Admin klika zwrot → `stripe_status = 'refunded'` w DB, wpis w `admin_audit_log`
- [ ] **Test 3:** Próba zwrotu już zwróconej sesji → komunikat błędu, status nie zmienia się
- [ ] **Test 4:** Uczeń w historii sesji widzi status "Zwrócono" dla zrefundowanej sesji
- [ ] **Test 5:** Admin bez uprawnień (zwykły użytkownik) próbuje wywołać akcję refund → błąd autoryzacji

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
