# ADR-005: Daily.co Prebuilt zamiast własnego UI wideo

**Status:** Zaakceptowany  
**Data:** 2026-05-05

## Kontekst

Platforma wymaga sesji wideo między uczniem a korepetytorem. Do integracji wideo z Daily.co istnieją dwa podejścia:

**Daily Prebuilt** — gotowy komponent wideo osadzony jako `<iframe>`. Daily.co dostarcza kompletny interfejs: obraz z kamery, mikrofon, przyciski sterowania, chat. Wymaga kilku linii kodu.

**Daily.co React SDK** (`@daily-co/daily-react`) — budowanie własnego UI przy użyciu hooków React. Pełna kontrola nad wyglądem i zachowaniem, ale wymaga samodzielnego implementowania każdego elementu interfejsu.

## Decyzja

Używamy **Daily Prebuilt** (`<iframe>`) dla MVP.

## Uzasadnienie

Własny UI wideo to istotny zakres prac: zarządzanie stanem kamery i mikrofonu, obsługa błędów połączenia, wskaźniki jakości połączenia, responsywność, testowanie na różnych przeglądarkach. Daily Prebuilt dostarcza to wszystko gotowe i przetestowane.

Kluczowa obserwacja: użytkownicy platformy (uczniowie i korepetytorzy) nie kupują "pięknego interfejsu wideo". Kupują skuteczne korepetycje. Daily Prebuilt jest wystarczająco dobry żeby to umożliwić.

Specyficzne wymaganie projektu — korepetytor skierowany kamerą na kartki — to standardowa funkcja każdej kamery, niezależna od UI. Daily Prebuilt to obsługuje bez żadnych dodatkowych prac.

## Konsekwencje

**Pozytywne:**
- Implementacja w kilka godzin zamiast kilku tygodni
- Przetestowany UI na dziesiątkach przeglądarek i urządzeń
- Wbudowana obsługa błędów połączenia, uprawnień kamery, jakości sieci
- Darmowy plan Daily.co: 10 000 minut/miesiąc — wystarczające dla MVP

**Negatywne / ryzyka:**
- Brak kontroli nad wyglądem — UI Daily.co, nie nasza marka
- Ograniczone możliwości customizacji (dostępne przez parametry URL)
- `<iframe>` może sprawiać trudności z integracją timera sesji (komunikacja między iframe a aplikacją)

**Obsługa timera:**
Timer sesji działa po stronie serwera (nie w iframe). Aplikacja Next.js wyświetla odliczanie obok iframe, a zakończenie sesji jest wyzwalane przez serwer — nie przez interakcję z Daily Prebuilt.

**Ścieżka do własnego UI (post-MVP):**
Jeśli pojawi się potrzeba własnego brandingu lub specyficznych funkcji (np. tablica do rysowania), migracja do `@daily-co/daily-react` jest możliwa bez zmiany logiki backendowej — tylko warstwa UI się zmienia.