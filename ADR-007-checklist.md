# ADR-007 — Checklist implementacji

Strategia: **expand → code → contract** (trzy oddzielne PR-y).  
Po każdym PR: `npm run lint` + `npx tsc --noEmit` + `npm run test:run` + `npm run build` + `npm run db:reset` + `npx playwright test`.

---

## PR 1 — DB Expand (tylko migracje, zero zmian w kodzie)

Cel: dodać nowe kolumny obok starych. Kod produkcyjny nie wie o nowych kolumnach — nic nie pęka.

### Migracja `20260601000002_adr007_expand.sql`

- [x] Dodaj do `ratings`:
  - `score_knowledge`, `score_organization`, `score_communication` (smallint, nullable)
  - `justification_category` (text enum, nullable)
  - `editable_until` (timestamptz, nullable)
  - `admin_weight` (numeric 0/0.5/1.0, default 1.0)
  - `admin_note` (text, nullable)
  - `payment_confirmed` (boolean, default true)
- [x] Dodaj do `tutor_profiles`: `bayesian_score` (nullable)
- [x] Zachowaj stare kolumny: `score`, `rating_avg`, `rating_count`

### Migracja `20260601000003_adr007_backfill.sql`

- [x] Backfill 3 wymiarów z `score` dla istniejących ocen uczniów
- [x] Backfill `bayesian_score` w `tutor_profiles` (k=5, μ=4.3)
- [x] Constraint `ratings_student_scores_complete` przeniesiony do PR 2 (nie blokuje starych insertów)

### Migracja `20260601000004_adr007_new_trigger.sql`

- [x] `refresh_tutor_rating()`: czyta 3 wymiary, oblicza `rating_avg` i `bayesian_score`; trigger odpala się też przy UPDATE
- [x] Trigger anomalii (AFTER_MVP) — nie implementowany; stary usunięty w `20260601000001`

---

## PR 2 — Kod aplikacji ✅

Cel: cały kod przechodzi na nowe kolumny. Stare kolumny w DB nadal istnieją — deploy preview działa.

### `src/domains/matching/types.ts`

- [ ] `SessionRating`: zamień `score: number` na `score_knowledge: number`, `score_organization: number`, `score_communication: number` + helper inline `avgScore = (k+o+c)/3`
- [ ] `TutorStudentInteraction`: `studentLastScore` zostaje, ale będzie teraz obliczany jako średnia 3 wymiarów
- [ ] `RatingFormState`: zamień `errors.score` na `errors.score_knowledge | score_organization | score_communication`

### `src/domains/matching/validation.ts`

- [ ] `validateRatingComment(comment, avgScore?)` — sygnatura bez zmian, `avgScore` to teraz średnia 3 wymiarów; sprawdź czy próg `<= 2` nadal ma sens dla wartości `<= 4` (tak, bo skala 1–5)
  - Uwaga: ADR-007 zmienia próg komentarza z `score <= 2` na `S < 4`. Zaktualizuj stałą `MIN_COMMENT_LOW_SCORE` i warunek.

### `src/domains/matching/actions.ts` — `submitRating`

- [ ] Parsuj 3 wartości z formData: `score_knowledge`, `score_organization`, `score_communication`
- [ ] Walidacja: każdy wymiar 1–5 dla ucznia
- [ ] Oblicz `avgScore = (k+o+c)/3` i przekaż do `validateRatingComment`
- [ ] INSERT: zapisz 3 kolumny, `editable_until = now() + 15 min`, `payment_confirmed: true`
- [ ] Usuń stary `score` z INSERT

### `src/domains/matching/queries.ts`

- [ ] `getRatingsForSession`: select `score_knowledge, score_organization, score_communication` zamiast `score`; dodaj `admin_weight`
- [ ] `getStudentPreviousRatingOfTutor`: select 3 kolumny zamiast `score`
- [ ] `getTutorStudentInteractions`: `studentLastScore = round((k+o+c)/3, 1)`; dodaj select dla 3 kolumn

### `src/domains/matching/components/RatingForm.tsx`

- [ ] Zastąp jeden blok gwiazdek **trzema oddzielnymi** (każdy z osobnym `name`):
  - `score_knowledge` — label: "Merytoryka"
  - `score_organization` — label: "Organizacja"
  - `score_communication` — label: "Komunikacja"
- [ ] `submitDisabled`: wszystkie 3 wybrane (nie jeden)
- [ ] Próg komentarza obowiązkowego: `avgScore < 4` (nie `<= 2` jak dotąd)
- [ ] Dodaj dropdown `justification_category` — pojawia się gdy `avgScore < 4`, opcje z ADR-007 §2c
- [ ] Dodaj obsługę `editable_until`:
  - Po wejściu na stronę `/rate/[requestId]` gdy ocena już istnieje i `editable_until > now()`: pokaż tryb edycji z wypełnionym formularzem i countdownem
  - Po upływie `editable_until`: pokaż "Ocena zablokowana" (nie formularz)
  - **Uwaga:** to wymaga zmiany w `/rate/[requestId]/page.tsx` — `hasRatingForSession` nie może już od razu przekierowywać, jeśli ocena jest edytowalna

### `src/app/(app)/rate/[requestId]/page.tsx`

- [ ] Zmień logikę `alreadyRated`:
  - Jeśli ocena istnieje i `editable_until > now()` → pokaż formularz w trybie edycji (pre-fill wartości)
  - Jeśli ocena istnieje i `editable_until <= now()` → przekieruj do `/dashboard`
- [ ] Przekaż do `RatingForm` prop `existingRating` (pre-fill) gdy edycja możliwa

### `src/domains/matching/components/StudentRequestStatus.tsx`

- [ ] `Poprzednia ocena: {score}★` → `Poprzednia ocena: ⌀ {((k+o+c)/3).toFixed(1)}★`

### `src/domains/matching/components/TutorDashboard.tsx`

- [ ] `studentLastScore` wyświetlany jako `X.X★` (już jest, sprawdź formatowanie)

### `src/app/(app)/history/[requestId]/page.tsx`

- [ ] Komponent `Stars`: renderuj gwiazdki z `avgScore = (k+o+c)/3` zaokrąglony do 0.5
- [ ] Komponent `RatingCard` dla oceny ucznia: pokaż 3 wiersze (Merytoryka: X★, Organizacja: X★, Komunikacja: X★) + średnia
- [ ] Komponent `RatingCard` dla oceny korepetytora: nie ma gwiazdek; pokaż flagę i notatkę jeśli jest (zamiast `Stars`)

### `src/domains/admin/queries.ts` i `UsersTable.tsx`

- [ ] Bez zmian — admin nadal wyświetla `rating_avg` (prosta średnia). `bayesian_score` to wewnętrzny score rankingowy, nie zastępuje `rating_avg` w adminie.

---

## PR 3 — DB Contract ✅

Cel: usunąć stare kolumny. Nowy kod już ich nie używa.

### Migracja `20260601000005_adr007_contract.sql`

- [ ] `alter table ratings drop column score`
- [ ] ~~`alter table ratings drop column flagged_for_review`~~ — usunięte w `20260601000001`
- [ ] ~~`alter table tutor_profiles drop column wilson_score`~~ — usunięte w `20260601000001`

**Przed napisaniem tej migracji:** upewnij się że `grep -r '"score"' src/` i `grep -r '\.score\b' src/` zwracają zero trafień poza migration files.

---

## Po każdym PR — weryfikacja

- [ ] `npm run lint`
- [ ] `npx tsc --noEmit`
- [ ] `npm run test:run`
- [ ] `npm run build`
- [ ] `npm run db:reset`
- [ ] `npx playwright test`

---

## Testy do zaktualizowania (w PR 2)

Poniższe testy wstawiają do DB `score` dla `rated_by='student'` — po migracji trzeba zmienić na 3 kolumny:

- [ ] `e2e/rating.spec.ts` — wszystkie `db.from('ratings').insert({ score: X, rated_by: 'student' })`
- [ ] `e2e/settings.spec.ts` — `createOldSessionWithRatings` — wstawia `score: 4`
- [ ] `e2e/rating.spec.ts` — testy klikające `input[name="score"]` — zmienić na 3 zestawy gwiazdek
- [ ] `e2e/z-happy-path.spec.ts` — pełny flow oceny — sprawdzić czy używa gwiazdek

## Nowe testy do napisania (w PR 2)

- [ ] Formularz 3D: uczeń widzi 3 zestawy gwiazdek; submit zablokowany dopóki nie wypełni wszystkich 3
- [ ] Dropdown kategorii: pojawia się gdy średnia < 4, znika gdy ≥ 4
- [ ] Dropdown kategorii: `other` wymaga tekstu ≥ 50 znaków
- [ ] Okno edycji: po wysłaniu oceny przez ucznia, powrót na `/rate/[requestId]` w ciągu 15 min pokazuje formularz w trybie edycji z wypełnionymi wartościami
- [ ] Okno edycji: po 15 minutach redirect do `/dashboard`
- [ ] `payment_confirmed = true` w DB po zapisaniu oceny
- [ ] Historia sesji: 3 wymiary widoczne dla ucznia i korepetytora
- [ ] `bayesian_score` aktualizuje się w `tutor_profiles` po zapisaniu oceny

---

## Rzeczy do sprawdzenia podczas implementacji

- [ ] Sprawdź czy `get_pending_rating` RPC (używana w middleware) czyta `score` — jeśli tak, zaktualizuj
- [ ] Sprawdź wszystkie snapshoty/typy generowane przez Supabase (`database.types.ts`) — czy wymagają regeneracji po migracji
- [ ] `submitRating` action jest idempotentna (duplikat zwraca `23505`) — czy logika edycji (UPDATE zamiast INSERT) zachowuje idempotentność
