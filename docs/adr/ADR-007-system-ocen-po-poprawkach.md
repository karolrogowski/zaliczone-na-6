# ADR-007: Wielowymiarowy system ocen z ważoną średnią Bayesowską

**Status:** Zaakceptowany  
**Data:** 2026-06-01  
**Supersedes:** ADR-006 §4 (Wilson score), §3 (pojedyncza gwiazdka, próg komentarza)

## Kontekst

ADR-006 zaprojektował mechanikę zbierania ocen (obowiązkowa ocena, blokada 4h, soft flag, obustronne ocenianie). Nie zdefiniował jednak algorytmu liczenia rankingu. Wilson score opisany w ADR-006 §4 ma dwie wady: (1) nie uwzględnia czasu wystawienia oceny — korepetytor "płaci" za błędy sprzed roku, (2) wymaga sprowadzenia wyniku do proporcji binarnej, co traci informację o stopniu pozytywności (3★ vs 4★ to to samo).

Ponadto pojedyncza gwiazdka (1–5) daje korepetytorowi wynik bez żadnego wskazania *gdzie* traci punkty.

## Decyzja

### 1. Trójwymiarowa ocena zamiast pojedynczej gwiazdki

Uczeń ocenia trzy wymiary (każdy 1–5, domyślnie 5):

| Kolumna | Co mierzy |
|---|---|
| `score_knowledge` | Wiedza, jakość wyjaśnień |
| `score_organization` | Punktualność, przygotowanie materiałów |
| `score_communication` | Cierpliwość, sposób tłumaczenia, atmosfera |

Zagregowana ocena pojedynczej recenzji: `S = (score_knowledge + score_organization + score_communication) / 3`

Kolumna `stars` zostaje usunięta (contract po merge kodu używającego nowych kolumn).

### 2. Waga pojedynczej oceny

```
w_i = w_student × w_time × w_just × w_admin
```

#### 2a. Waga uzasadnienia (`w_just`) — MVP

| Zagregowana ocena S | Uzasadnienie | w_just |
|---|---|---|
| S ≥ 4 | cokolwiek (lub brak) | 1.0 |
| S < 4 | brak | 0.5 |
| S < 4 | tylko kategoria (dropdown) | 0.7 |
| S < 4 | kategoria + tekst ≥ 50 znaków | 1.0 |
| S < 4 | tylko tekst < 50 znaków | 0.6 |

Kategorie problemów (nowe pole `justification_category`, enum):
- `late_or_cancelled` — Spóźnienie / odwołanie zajęć
- `unprepared` — Brak przygotowania / materiałów
- `low_quality` — Niska jakość merytoryczna
- `communication` — Problemy z komunikacją
- `misconduct` — Niewłaściwe zachowanie
- `other` — Inne (wymaga tekstu ≥ 50 znaków)

#### 2b. Waga admina (`w_admin`) — MVP

Trzy wartości: **0, 0.5, 1.0** (kolumna `admin_weight`, domyślnie 1). Admin ustawia ją w panelu przy przeglądaniu zgłoszenia; każda zmiana wymaga wypełnienia `admin_note`.

- `0` — jawna manipulacja, fake, ocena za niezaistniałe zajęcia
- `0.5` — wątpliwa, częściowo uzasadniona
- `1.0` — domyślnie

Zastępuje obecne `flagged_for_review` (bool) — richer signal.

#### 2c. Waga czasu (`w_time`) — AFTER_MVP

Aktywować po zebraniu ≥ 3 miesięcy danych. Do tego czasu `w_time = 1.0` dla wszystkich ocen.

```
w_time = exp(-λ(N_t) × Δt_days)

λ(N_t):
  N_t < 20   → 0.003  (half-life ≈ 230 dni)
  N_t < 100  → 0.005  (half-life ≈ 140 dni)
  N_t ≥ 100  → 0.008  (half-life ≈ 87 dni)
```

Oceny ze S ≥ 4 używają λ × 0.7 (wolniejszy decay — nagradza długotrwałą jakość).

#### 2d. Waga ucznia (`w_student`) — AFTER_MVP

Aktywować po zebraniu ≥ 3 miesięcy danych. Do tego czasu `w_student = 1.0`.

Mierzy odchylenie ocen ucznia od mediany rynkowej dla tych samych korepetytorów:

```
d(j,t) = S_j_t − avg(S_t bez ucznia j)
avg_d(j) = średnia d(j,t) po wszystkich ocenach ucznia j

w_student(j) = max(0.1, 1 + 0.3 × min(0, avg_d(j)) × min(1, n_j/10))
```

- `n_j < 3`: cold start, `w_student = 1.0` (oceny oznaczane jako "niezweryfikowane" w adminie)
- Asymetria: zawyżanie (`avg_d > 0`) nie obniża wagi — tylko zaniżanie jest karane

### 3. Bayesowska średnia ważona zamiast Wilson score

```
S_tutor = (Σ S_i × w_i + k × μ) / (Σ w_i + k)
```

- `μ` — globalna średnia platformy (początkowo 4.3, przeliczana co tydzień triggerem)
- `k = 5` — siła priora

Efekty:
- Nowy korepetytor z 1 oceną 5★: wynik ≈ 4.38 zamiast 5.0
- 50 ocen średnio 4.7: wynik ≈ 4.66 (prior znikomy)
- Naturalnie rozwiązuje cold start bez osobnego mechanizmu boostowania

Kolumna `wilson_score` zostaje zastąpiona przez `bayesian_score` w `tutor_profiles` (contract w osobnym PR).

### 4. Progi prowizji (AFTER_MVP — wymaga modułu płatności)

Status jest przechowywany w kolumnie `commission_tier` w `tutor_profiles` i aktualizowany triggerem po każdej zmianie `bayesian_score`.

| bayesian_score | Prowizja | Status |
|---|---|---|
| ≥ 4.7 | 10% | Top Tutor |
| 4.3–4.69 | 15% | Trusted |
| 3.8–4.29 | 20% | Standard |
| < 3.8 | 25% | Probation |

Progi zamiast funkcji liniowej — łatwiejsze do zakomunikowania korepetytorom (konkretny cel: "przekrocz 4.3 = niższa prowizja").

### 5. Priorytet powiadomień — kolejka zleceń (AFTER_MVP)

Zastępuje obecne sortowanie wyłącznie po wilson_score.

```
P_t = 0.6 × (bayesian_score − 1)/4 + 0.2 × response_rate + 0.1 × acceptance_rate + 0.1 × boost
```

Rzuty powiadomień:
- Rzut 1 (natychmiast): ulubieni korepetytorzy ucznia
- Rzut 2 (po 60 s): P_t ≥ 0.8
- Rzut 3 (po 3 min): P_t ≥ 0.5
- Rzut 4 (po 7 min): wszyscy pozostali

`response_rate` i `acceptance_rate` ∈ [0,1] przeliczane z historii zleceń. `boost = 1` dla nowych korepetytorów (pierwsze 5 zleceń lub 90 dni), potem 0.

Wyłączenia obustronnego preferencji (już zaimplementowane) pozostają niezmienione.

### 6. Wyświetlanie oceny — próg aktywacji

Publiczna ocena (gwiazdki) wyświetla się dopiero przy **min. 5 ocenach** (`rating_count >= 5` w `tutor_profiles`). Wcześniej: *"Zbiera pierwsze opinie"*.

Wewnętrznie (do priorytetu) `bayesian_score` liczony od pierwszej oceny.

### 7. Okno edycji oceny

Po wystawieniu oceny uczeń ma **15 minut** na edycję. Nowe pole `editable_until = created_at + interval '15 minutes'`.

UI pokazuje odliczanie. Po upływie — tylko admin może zmienić przez `admin_weight`.

### 8. Automatyczne flagi anty-fraud (AFTER_MVP)

Trigger po każdym INSERT do `ratings` sprawdza wzorce i zapisuje do tabeli `rating_flags`:

| Flaga | Trigger |
|---|---|
| `negative_burst` | Korepetytor: 3+ ocen S ≤ 2 w 7 dni |
| `positive_burst` | Korepetytor: 5+ ocen S = 5 w 24h od nowych kont |
| `score_jump` | bayesian_score skok ≥ 1.5 pkt w 14 dni |
| `student_troll` | Uczeń: 3+ ocen S ≤ 2 różnym korepetytorom w 30 dni |
| `conflict` | Uczeń ocenił S = 1 + korepetytor zgłosił ucznia |

Każda flaga trafia do panelu admina z proponowaną akcją (zmień `admin_weight`, kontakt, blokada).

## Uzasadnienie odrzuconych alternatyw

**Wilson score (ADR-006 §4):** nie uwzględnia wieku ocen ani wiarygodności wystawiającego; wymaga sprowadzenia do proporcji binarnej. Zastąpiony Bayesowską średnią ważoną.

**Liniowa funkcja prowizji zamiast progów:** matematycznie sprawiedliwsza, ale brak jasnych celów gamifikacyjnych. Korepetytorzy nie wiedzą *o ile* muszą się poprawić. Progi wygrywają z powodów marketingowych.

**Waga ucznia od pierwszej oceny:** cold start problem — nowy uczeń bez historii dostaje niesprawiedliwie obniżoną wagę. Próg n_min = 3 eliminuje ten problem.

**Agresywny decay (ADR wstępny: 30 dni → 0.5):** destabilizuje korepetytorów z małą liczbą ocen. Adaptacyjna λ(N_t) rozwiązuje obie strony problemu.

## Konsekwencje implementacyjne

### Zmiany schematu DB (expand-then-contract w kolejności PR-ów)

**PR Expand — nowe kolumny, stare zostają:**
```sql
-- ratings
alter table ratings
  add column score_knowledge    smallint check (score_knowledge between 1 and 5),
  add column score_organization smallint check (score_organization between 1 and 5),
  add column score_communication smallint check (score_communication between 1 and 5),
  add column justification_category text
    check (justification_category in
      ('late_or_cancelled','unprepared','low_quality','communication','misconduct','other')),
  add column editable_until     timestamptz,
  add column admin_weight       numeric(3,1) not null default 1.0
    check (admin_weight in (0, 0.5, 1.0)),
  add column admin_note         text;

-- tutor_profiles
alter table tutor_profiles
  add column bayesian_score  numeric(4, 3),
  add column rating_count    integer not null default 0,
  add column commission_tier text
    check (commission_tier in ('top_tutor','trusted','standard','probation'));
```

**PR Code — kod używa nowych kolumn, backfill stars → score_***  

**PR Contract — usunięcie starych kolumn:**
```sql
alter table ratings drop column stars;
alter table tutor_profiles drop column wilson_score;
-- flagged_for_review zastąpiony przez admin_weight < 1.0
alter table ratings drop column flagged_for_review;
```

**PR AFTER_MVP — tabele dla zaawansowanego algorytmu:**
```sql
create table rating_flags (...);
alter table tutor_profiles
  add column response_rate    numeric(4,3),
  add column acceptance_rate  numeric(4,3),
  add column boost_active     boolean not null default false,
  add column boost_expires_at timestamptz;
```

### Funkcje DB

- Trigger `update_tutor_bayesian_score()` — po każdym INSERT/UPDATE na `ratings`, przelicza `bayesian_score` i `rating_count` w `tutor_profiles`
- Funkcja `calculate_justification_weight(score numeric, category text, text_length int) → numeric`
- Widok `tutor_rating_summary` — trzy wymiary osobno + zagregowana + bayesian_score

### Strona `/rate/[requestId]`

- Trzy suwaki/gwiazdy (merytoryka, organizacja, komunikacja) zamiast jednego
- Dropdown kategorii + pole tekstowe pojawiają się gdy S < 4 (warunkowy render)
- Countdown edycji widoczny w pierwszych 15 minutach po wysłaniu
- Walidacja: tekst w "Inne" wymagany ≥ 50 znaków, blokada aaaaa... patternów

### Parametry konfiguracyjne (tabela `platform_config`)

| Klucz | Wartość domyślna |
|---|---|
| `rating_alpha` | 0.3 |
| `rating_n_min` | 3 |
| `rating_lambda_small` | 0.003 |
| `rating_lambda_large` | 0.008 |
| `rating_bayes_k` | 5 |
| `rating_display_threshold` | 5 |
| `rating_edit_window_minutes` | 15 |
| `notification_boost_assignments` | 5 |
| `notification_boost_days` | 90 |
