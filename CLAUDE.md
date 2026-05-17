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

Po większych zmianach (nowa strona, nowy moduł, zmiana schematu DB, refactoring) uruchom dodatkowo:
4. `npm run build` — weryfikacja buildu produkcyjnego
5. `npx playwright test` — testy E2E (wymaga działającego Supabase: `npx supabase start`)

Nie zgłaszaj zadania jako ukończone dopóki wszystkie powyższe nie przechodzą.

### Język
- Cały tekst widoczny dla użytkownika piszemy po polsku.

### Baza danych
- Po dodaniu nowych migracji powiedz użytkownikowi, żeby uruchomił `npm run db:reset`.
- `npm run db:reset` resetuje bazę, tworzy konto admina i użytkowników testowych.
- Użytkownicy testowi: `uczen1@test.pl`, `uczen2@test.pl`, `korepetytor1–3@test.pl`, hasło: `testtest1`.
- Klient `admin.ts` (service role) używaj wyłącznie w domenie `admin/`.

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
- Dwustronny system ocen — aktualnie tylko uczeń ocenia korepetytora; brakuje oceny korepetytora → ucznia.

## Poza zakresem MVP (AFTER_MVP)
- Płatności (Stripe) — tabela `session_financials` istnieje, ale logika płatności nie.
- Powiadomienia email — Supabase email działa dla auth, brak transakcyjnych emaili dla zdarzeń biznesowych.
- VIP tier — algorytm opóźniania powiadomień wg oceny korepetytora.
- Logowanie Google/Apple, weryfikacja korepetytora, wirtualna tablica, mechanizm przedłużania sesji, wirtualny portfel i wypłaty.
