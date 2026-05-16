# ADR-006: Dwustronny system ocen z obowiązkową oceną i rankingiem Wilsona

**Status:** Zaakceptowany  
**Data:** 2026-05-16

## Kontekst

Po zakończeniu sesji wideo zarówno uczeń, jak i korepetytor powinni wystawić sobie ocenę. System ocen spełnia dwa cele:

1. **Jakościowy** — korepetytorzy z wyższą oceną widzą zlecenia wcześniej niż pozostali (mechanizm VIP tier, ADR do napisania przy implementacji algorytmu).
2. **Ochronny** — identyfikacja toksycznych użytkowników po obu stronach.

Problemem do rozwiązania jest zaprojektowanie mechanizmu, który:
- gwarantuje wystawienie oceny kiedy wrażenia są świeże (bezpośrednio po sesji),
- chroni korepetytora przed złośliwymi, nieuzasadnionymi niskimi ocenami,
- nie blokuje trwale użytkownika, który zamknął aplikację przed oceną,
- nie karze jednej strony za zachowanie drugiej.

## Decyzja

### 1. Obowiązkowa natychmiastowa ocena — brak przycisku "pomiń"

Sesja kończy się → użytkownik jest natychmiast przekierowany na ekran oceny (`/rate/[requestId]`). Na stronie nie istnieje przycisk "pomiń", "później" ani możliwość nawigacji wstecz. Jest tylko formularz i przycisk "Wyślij ocenę".

Cel: ocena wystawiona w ciągu minut od sesji jest wiarygodna; ocena wystawiana z opóźnieniem — nie.

### 2. Twarda blokada przy ponownym otwarciu aplikacji (okno 4 godzin)

Jeśli użytkownik zamknął aplikację przed wysłaniem oceny, middleware Next.js (`middleware.ts`) przy każdym żądaniu sprawdza:

> Czy istnieje sesja ze statusem `completed`, która zakończyła się mniej niż 4 godziny temu i nie ma jeszcze oceny od tego użytkownika?

Jeśli tak — redirect na `/rate/[requestId]`, niezależnie od tego, jaki URL wpisał użytkownik.

Po 4 godzinach blokada odpada automatycznie. Sesja zostaje oznaczona jako `unrated`. Nie można już wystawić oceny retroaktywnie.

Wybór 4 godzin: wystarczająco długo, żeby zdążyć po powrocie do domu; wystarczająco krótko, żeby sesja była jeszcze świeża.

### 3. Asymetryczne oceny — inna funkcja dla każdej strony

**Uczeń ocenia korepetytora:**
- Ocena 1–5 gwiazdek
- Ocena 1–2: komentarz obowiązkowy (min. 50 znaków) — redukuje złośliwe oceny bez ich blokowania
- Ocena 3–5: komentarz opcjonalny
- Dwie opcje bonusowe (checkboxy, opcjonalne):
  - "Chcę uczyć się z tym korepetytorem w przyszłości" — system zapamięta preferencję i przy kolejnym zleceniu ucznia, ten korepetytor dostanie powiadomienie 10 s wcześniej niż wynikałoby z jego VIP tieru
  - "Nie polecaj mi tego korepetytora" — korepetytor nie pojawia się w feedzie ucznia przy kolejnych zleceniach
- Ocena **wchodzi do publicznego rankingu** korepetytora

**Korepetytor ocenia ucznia:**
- Ocena 1–5 gwiazdek
- Ocena 1–2: komentarz obowiązkowy (min. 50 znaków)
- Ocena 3–5: komentarz opcjonalny
- Ocena **nie jest publiczna** — służy wyłącznie do wykrywania toksycznych uczniów
- Trzy lub więcej ocen 1–2 wystawionych przez różnych korepetytorów → soft flag w panelu admina

### 4. Ranking korepetytorów — Wilson score lower bound zamiast średniej arytmetycznej

Ranking VIP nie używa prostej średniej `AVG(stars)`. Zamiast tego stosujemy **dolną granicę 95% przedziału ufności dla proporcji** (wzór Wilsona):

```
score = (p̂ + z²/2n − z√(p̂(1−p̂)/n + z²/4n²)) / (1 + z²/n)

gdzie:
  p̂ = (suma gwiazdek) / (5 × liczba ocen)   — proporcja "pozytywności"
  n  = liczba ocen
  z  = 1.96                                   — 95% przedział ufności
```

W praktyce oznacza to:
- Korepetytor z 20 ocenami po 4.8★ bije korepetytora z 2 ocenami po 5.0★
- Jeden outlier przy dużej liczbie ocen prawie nie zmienia wyniku
- Nowy korepetytor (mało ocen) startuje z niskim score, ale stabilnym — nie da się "kupić" pozycji jedną oceną

Próg wejścia do algorytmu VIP: minimum 5 ocen. Poniżej — korepetytor traktowany jako neutralny (środek stawki).

### 5. Detekcja anomalii (soft flag, nie automatyczne usuwanie)

Jeśli korepetytor posiada ≥ 10 ocen ze średnią ≥ 4.5★ i otrzymuje ocenę 1–2★:
- Ocena **wchodzi do systemu** normalnie (nie jest usuwana ani ukrywana)
- Do panelu admina trafia wpis "Podejrzana ocena do weryfikacji"
- Admin może oznaczyć ocenę jako "zweryfikowana" lub "usunięta (nadużycie)"

Decyzja o usunięciu należy zawsze do admina, nie do algorytmu.

### 6. Konsekwencje braku oceny (`unrated`) — stopniowe, nie blokujące

Sesja oznaczona jako `unrated` jest neutralna dla rankingu (jakby nie istniała). Przy systematycznym unikaniu ocen:

| Liczba `unrated` z rzędu | Skutek dla ucznia | Skutek dla korepetytora |
|---|---|---|
| 1–2 | brak | brak |
| 3 | zlecenia ucznia trafiają do korepetytorów z 15 s opóźnieniem | spada o jeden poziom VIP na 30 dni |

Licznik resetuje się po wystawieniu oceny.

### 7. Niezależność stron

Blokada i konsekwencje działają **niezależnie dla każdego użytkownika**. Uczeń nie jest blokowany dlatego, że korepetytor nie ocenił. Korepetytor nie traci VIP tieru dlatego, że uczeń zamknął aplikację.

## Uzasadnienie odrzuconych alternatyw

**Ocena opcjonalna (dobrowolna):** Praktyka pokazuje, że dobrowolne oceny wystawiają głównie użytkownicy z ekstremalnymi doświadczeniami (1★ lub 5★), co wypacza statystyki. Odrzucono.

**Blokada 24h zamiast 4h:** Sesja sprzed doby jest słabo pamiętana; użytkownik ocenia "z głowy", nie z doświadczenia. Zbyt długie okno podważa cel systemu. Odrzucono na rzecz 4h.

**Automatyczne usuwanie ocen odstających:** Algorytm nie zna kontekstu — korepetytor może naprawdę mieć gorszy dzień. Decyzja zawsze należy do człowieka (admina). Odrzucono automatykę, zastosowano soft flag.

**Oceny korepetytora → ucznia jako publiczne:** Publiczna "ocena ucznia" tworzy asymetrię władzy (korepetytor może odstraszać uczniów) i zniechęca uczniów do korzystania z platformy. Odrzucono na rzecz ocen wewnętrznych.

## Konsekwencje implementacyjne

**Zmiany w bazie danych:**
- Tabela `ratings` — dodać kolumny: `rated_by` (enum: `student` | `tutor`), `preference` (enum: `want_again` | `avoid` | null), `flagged_for_review` (bool)
- Widok lub kolumna `wilson_score` w `tutor_profiles` — przeliczany triggerem po każdej nowej ocenie
- Kolumna `unrated_streak` w `profiles` — inkrementowana przy upływie okna 4h bez oceny

**Middleware Next.js:**
- Po każdym żądaniu (dla zalogowanego użytkownika) sprawdza RPC `get_pending_rating(user_id)` — zwraca `request_id` lub null
- Redirect na `/rate/[requestId]` jeśli wynik nie jest null

**Strona `/rate/[requestId]`:**
- Dynamicznie renderuje widok ucznia lub korepetytora w zależności od roli
- Walidacja: komentarz wymagany przy ≤ 2★ (walidacja po stronie klienta i serwera)
- Obsługa idempotentna — podwójne wysłanie formularza nie tworzy duplikatu

**Algorytm VIP:**
- Kolumna `wilson_score` używana do sortowania w zapytaniu `get_available_tutors`
- Próg wejścia: `rating_count >= 5`