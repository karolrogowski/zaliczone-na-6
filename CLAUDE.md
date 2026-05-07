@AGENTS.md

# Zaliczone na 6 — instrukcje dla Claude

## Co to jest
Platforma korepetycji on-demand (model Uber): uczeń składa zlecenie → korepetytor akceptuje w czasie rzeczywistym → sesja wideo (Daily.co, jeszcze nie zaimplementowane).

## Stack
- Next.js 16 (App Router) — breaking changes, czytaj AGENTS.md
- Supabase lokalnie przez Docker (auth, PostgreSQL, Realtime)
- Tailwind CSS
- Vitest (testy jednostkowe), brak E2E

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

### Testy
- Po każdej zmianie kodu uruchom `npm run test:run` i upewnij się, że wszystkie przechodzą.
- Nie pytaj o strategię testowania — testy jednostkowe Vitest, bez E2E.

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

## Co jeszcze nie jest zaimplementowane
- Połączenie wideo (Daily.co) — tabela `sessions` już istnieje, kolumny `daily_room_name/url` są nullable do czasu integracji.
- Płatności (Stripe) — tabela `session_financials` istnieje, ale logika płatności nie.
- Powiadomienia email — Supabase email działa dla auth, brak transakcyjnych emaili dla zdarzeń biznesowych.
