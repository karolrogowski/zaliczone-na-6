@AGENTS.md

# Zaliczone na 6 — instrukcje dla Claude

## Co to jest
Platforma korepetycji on-demand (model Uber): uczeń składa zlecenie → korepetytor akceptuje w czasie rzeczywistym → sesja wideo (3-rd party provider).

## Stack
- Next.js 16 (App Router) — breaking changes, czytaj AGENTS.md
- Supabase lokalnie przez Docker (auth, PostgreSQL, Realtime)
- 3-rd party provider — sesje wideo 1:1 (osadzone przez iframe); zmiana providera tylko w `src/domains/sessions/video-provider.ts`
- Tailwind CSS
- Vitest (testy jednostkowe) + Playwright (testy E2E)

## Struktura kodu
```
src/
  domains/
    auth/        — rejestracja, logowanie, reset hasła, ustawienia, profil korepetytora
    matching/    — zlecenia, matching, oceny, profile publiczne
    admin/       — panel admina (MFA wymagane)
  shared/supabase/
    server.ts    — klient serwerowy (SSR)
    client.ts    — klient przeglądarkowy
    admin.ts     — service role (tylko domena admin)
  app/
    (auth)/      — strony bez layoutu aplikacji
    (app)/       — strony z nagłówkiem i sidebar (docelowo)
    admin/       — panel administracyjny
```

## Zasady pracy

### Testy i jakość kodu
Po każdej zmianie kodu uruchom wszystkie poniższe komendy i upewnij się, że przechodzą — w tej kolejności:
1. `npm run lint` — linting
2. `npx tsc --noEmit` — sprawdzenie typów TypeScript
3. `npm run test:run` — testy jednostkowe (Vitest)

Po większych zmianach (nowa strona, nowy moduł, **zmiana schematu DB**, refactoring) uruchom dodatkowo:
4. `npm run build` — weryfikacja buildu produkcyjnego
5. `npm run db:reset` — jeśli była zmiana schematu DB (nowa migracja)
6. `npx playwright test` — testy E2E (wymaga działającego Supabase: `npx supabase start`)

**Zmiana schematu DB = nowa migracja SQL = obowiązkowe E2E. Bez wyjątków.**

Nie zgłaszaj zadania jako ukończone dopóki wszystkie powyższe nie przechodzą.

### Język
- Cały tekst widoczny dla użytkownika piszemy po polsku.

### Narzędzia CLI dostępne w środowisku
- `gh` — GitHub CLI: sprawdzaj sekrety (`gh secret list`), obserwuj pipeline (`gh run watch`), zarządzaj PR-ami. Używaj zamiast pytać użytkownika o stan CI/CD czy sekrety.
- `npx supabase` — CLI Supabase: migracje, status lokalny.

### Baza danych
- Po dodaniu nowych migracji powiedz użytkownikowi, żeby uruchomił `npm run db:reset`.
- `npm run db:reset` resetuje bazę, tworzy konto admina i użytkowników testowych.
- Użytkownicy testowi: `uczen1@test.pl`, `uczen2@test.pl`, `korepetytor1–3@test.pl`, hasło: `TestTest1!`.
- Klient `admin.ts` (service role) używaj wyłącznie w domenie `admin/`.

### Strategia migracji: expand-then-contract
**Zasada:** każda migracja musi być backwards-compatible z aktualnie wdrożonym kodem produkcyjnym. Powód: preview deployment na Vercel używa tego samego Supabase Cloud co produkcja, a migracje trafiają na Cloud DOPIERO po merge'u do `main` (workflow `post-deploy.yml`). W oknie między deployem preview a merge'em produkcja działa na starym schemacie + nowym kodzie.

**Dla zmian niekompatybilnych rozbij na osobne PR-y:**
1. **Expand** — migracja dodaje nową strukturę (kolumna nullable, nowa polityka obok starej, nowa tabela). Kod jeszcze nie używa. Merge i deploy.
2. **Migrate code** — kod zaczyna używać nowej struktury. Stara dalej działa.
3. **Contract** (opcjonalnie) — migracja usuwa starą strukturę.

**Czerwone flagi w jednym PR-cie:**
- `drop column` / `drop table` / `drop policy` razem z kodem który z nich korzysta
- `alter column ... not null` na tabeli z istniejącymi rekordami bez backfilla
- zmiana typu kolumny używanej przez aktualnie wdrożony kod
- rename kolumny lub tabeli

Jeśli widzisz taką zmianę — zaproponuj rozbicie na osobne PR-y PRZED implementacją.

### Realtime + server actions
- `revalidatePath()` w server action wywołanej przez `onClick` (nie przez `useActionState`) NIE wymusza odświeżenia klienta automatycznie.
- Po każdej takiej akcji wywołaj `router.refresh()` po stronie klienta.
- Hooki real-time (`useTutorRequests`, `useStudentRequest`) mają polling jako fallback — Supabase Realtime lokalnie bywa zawodne.

### Serwer vs klient
- Komponenty serwerowe pobierają dane i przekazują jako props — nie fetchuj w komponentach klienckich bez wyraźnego powodu.
- Server actions w plikach z `'use server'` na górze; nigdy nie mieszaj z kodem klienckim.

### Śledzenie wymagań
- Po każdej zaimplementowanej funkcjonalności zaktualizuj `requirements/requirements.adoc` — zmień status w tabeli podsumowującej oraz w nagłówku danej sekcji (np. `MVP` → `DONE`).

## Co jeszcze nie jest zaimplementowane (MVP)
*(brak — wszystkie funkcje MVP zostały zaimplementowane)*

## Płatności (Stripe) — zaimplementowane
Pełny przepływ pieniędzy (kroki 1–10 z `docs/payment-implementation-plan.md`, ADR-008):
preautoryzacja przy złożeniu zlecenia → capture po sesji → podział 70/30 (prowizja z
`platform_config.commission_pct`) → transfer na konto Stripe Connect korepetytora →
saldo i ręczna wypłata w Ustawieniach ("Zarobki"). Zwroty admina cofają też transfer.
Ewidencja w `session_financials`. Wymaga aktywowanego Stripe Connect na koncie platformy;
testy E2E Connect same się pomijają, gdy Connect nieaktywny.

## Poza zakresem MVP (AFTER_MVP)
- Powiadomienia email — Supabase email działa dla auth, brak transakcyjnych emaili dla zdarzeń biznesowych.
- VIP tier — algorytm opóźniania powiadomień wg oceny korepetytora.
- Logowanie Google/Apple, weryfikacja korepetytora, wirtualna tablica, mechanizm przedłużania sesji.
