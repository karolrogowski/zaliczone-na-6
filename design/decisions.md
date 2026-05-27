# Design decisions — Zaliczone na 6

> Plik prowadzony na bieżąco podczas sesji designu UX.
> Każda decyzja ma datę, kontekst i uzasadnienie.

---

## Persony

**Decyzja:** Dwie persony — Uczeń i Korepetytor.

- **Uczeń:** dowolny etap edukacji (podstawówka → studia), użytkownik w sytuacji nagłej (panika przed klasówką), korzysta z laptopa/tabletu, płaci rodzic (decyzja finansowa poza aplikacją). Docelowo rozszerzenie o regularne sesje.
- **Korepetytor:** każdy kto chce dorabiać, elastyczna dostępność ("mam wolną chwilę — włączam"), motywacja: szybki zarobek + elastyczność, używa komputera.

**Zanotowane do rozwiązania produktowego:** korepetytor potrzebuje sposobu pokazania uczniowi obliczeń pisanych ręcznie (matematyka) — wirtualna tablica lub kamera na kartkę. Poza zakresem MVP.

---

## Kluczowe napięcia UX (z user journeys)

Cztery tematy, które będą wracać przy każdym ekranie:

1. **Szybkość onboardingu** — obie strony muszą zacząć działać w minuty, nie godziny.
2. **Ekrany oczekiwania** — najdłuższy i najbardziej emocjonalny moment w całym flow.
3. **Zaufanie finansowe** — uczeń/rodzic musi wiedzieć ile i jak; korepetytor musi ufać, że dostanie pieniądze.
4. **Powiadomienie o zleceniu** — serce platformy, musi działać bezbłędnie i natychmiastowo.

---

## System ocen (dwustronny)

**Decyzja:** Obie strony oceniają się nawzajem po każdej sesji — uczeń ocenia korepetytora i korepetytor ocenia ucznia.

**Decyzja:** Blokada po 3 niewystawionych ocenach (nie od razu). Przy każdej pominiętej ocenie pojawia się ostrzeżenie z licznikiem. Po 3 — blokada podstawowych funkcji:
- Uczeń: nie może złożyć nowego zlecenia
- Korepetytor: nie może włączyć dostępności (nie zarabia)

**Decyzja:** Każda ocena poniżej 4 gwiazdek wymaga pisemnego wyjaśnienia, minimum 50 słów. Zapobiega ocenom z frustracji bez kontekstu.

**Decyzja:** System jednoczesnego ujawnienia (*simultaneous reveal*, wzorem Airbnb). Obie strony wystawiają ocenę niezależnie, nie widząc oceny drugiej osoby. Oceny ujawniane dopiero gdy obie zostaną wystawione — lub po 48h. Imiona widoczne (wiesz kogo oceniasz), ale nie widzisz co ta osoba napisała dopóki sam nie wystawisz. Eliminuje efekt wzajemności i strategiczne ocenianie.

## Architektura informacji

**Decyzja:** Jedna aplikacja z trzema rozłącznymi rolami — uczeń, korepetytor, admin. Rola wybierana przy rejestracji, nie można jej zmienić po fakcie.

**Decyzja:** Desktop/laptop first. Telefon jako fallback — nie priorytet w MVP.

**Strefy aplikacji:**

- **Publiczna (bez logowania):** strona główna, logowanie, rejestracja, reset hasła, publiczny profil korepetytora
- **Uczeń:** dashboard, nowe zlecenie, oczekiwanie, sesja wideo, ocena, historia, ustawienia
- **Korepetytor:** dashboard (z togglem dostępności), powiadomienie o zleceniu, sesja wideo, zarobki, profil publiczny (edycja), historia, ustawienia
- **Admin (MFA):** użytkownicy, sesje, rozliczenia

**Ekrany krytyczne (★) — tu zapadają decyzje o zostaniu lub odejściu:**
- Nowe zlecenie (uczeń) — formularz musi być szybki i prowadzić za rękę
- Oczekiwanie (uczeń) — 5 minut niepewności, kluczowy moment emocjonalny
- Powiadomienie o zleceniu (korepetytor) — natychmiastowe, czytelne, z countdown
- Sesja wideo (obie strony) — punkt kulminacyjny całego flow

---

## Nawigacja i layout

**Decyzja:** Sidebar (panel boczny, stały) jako główna nawigacja w strefie zalogowanego użytkownika. Pasuje do desktop-first i daje dużo miejsca na etykiety przy małej liczbie sekcji.

**Decyzja:** Layout = sidebar (lewy, stały) + obszar treści (elastyczny, reszta szerokości).

**Decyzja:** Rejestracja na jednym ekranie — wybór roli + email + hasło. Minimalna liczba kroków, szczególnie ważne dla ucznia w panice.

**Decyzja:** Etykiety roli opisują intencję, nie tożsamość: "Szukam korepetytora" (nie "Uczeń"), "Chcę udzielać korepetycji" (nie "Korepetytor"). Powód: może rejestrować się rodzic, nie uczeń.

**Decyzja:** CTA zmienia się dynamicznie z wybraną rolą: "Zacznij się uczyć →" dla ucznia, "Zacznij zarabiać →" dla korepetytora.

**Decyzja:** Informacja "Bez karty kredytowej" widoczna pod tytułem formularza — odpowiada na obawy zanim zostaną wyartykułowane.

**Decyzja:** Po rejestracji wymagane potwierdzenie emaila. Użytkownik trafia na ekran "Sprawdź skrzynkę" i nie może korzystać z aplikacji do czasu kliknięcia linku aktywacyjnego.

---

### Formularz zlecenia (uczeń)

**Decyzja:** Poziom nauczania i preferowany język sesji NIE są w formularzu zlecenia — przechowywane w profilu ucznia z przypomnieniem o aktualizacji na nowy rok szkolny. Powód: nie ma sensu uzupełniać ich przy każdym zleceniu.

**Decyzja:** Formularz zlecenia zawiera tylko 3 pola:
1. Przedmiot — dropdown
2. Opis problemu — wolny tekst ("czego dokładnie nie rozumiesz")
3. Czas trwania — wybór: 30 min lub 60 min (tylko dwie opcje)

**Decyzja:** Stałe ceny platformy (MVP) — każda sesja kosztuje tyle samo niezależnie od korepetytora. Dwa progi cenowe: 30 min i 60 min. Uczeń widzi dokładną cenę na formularzu zanim wyśle zlecenie. Uzasadnienie: eliminuje złożoność zmiennych stawek, daje pełną przejrzystość finansową dla rodzica, zero niespodzianek przy płatności. Zróżnicowanie per korepetytor — po MVP.

**Decyzja:** Ceny sesji konfigurowane przez admina w panelu administracyjnym — nie są hardcodowane w aplikacji.

**Decyzja:** Płatność pobierana PRZED sesją (pre-authorization lub pełna płatność przy składaniu zlecenia). Uzasadnienie: zapobiega nadużyciom — uczeń nie może zamknąć przeglądarki po sesji i nie zapłacić.

**Decyzja (flow):** Jeśli uczeń nie ma zapisanej metody płatności i kliknie "Szukaj korepetytora" → pojawia się ekran/modal dodania karty → po dodaniu wraca do potwierdzenia zlecenia. Jeśli karta jest już zapisana → przechodzi bezpośrednio do ekranu oczekiwania.

---

### Powiadomienie o zleceniu (korepetytor)

**Decyzja:** Nowe zlecenie pojawia się jako nowy stan w obszarze treści (nie jako popup/modal) — pełne przejęcie widoku z paskiem alertu u góry. Powód: modal nad dashboardem mógłby zostać przypadkowo zamknięty.

**Decyzja:** Korepetytor widzi swój zarobek (np. 72 zł), nie pełną cenę ucznia (90 zł). Platforma nie ukrywa prowizji — korepetytor zna swój cennik, nie ma sensu pokazywać mu cudzych kwot.

**Decyzja:** Countdown widoczny w pasku alertu, nie jako duży timer — informuje o presji czasu bez wywoływania zbędnego stresu. Zmienia kolor na czerwony poniżej 15 sekund.

**Decyzja:** Przycisk "Pomiń" (nie "Odrzuć") — korepetytor nie odrzuca ucznia, tylko przepuszcza zlecenie. Lżejszy język, mniejsze poczucie winy.

**Decyzja:** Dashboard korepetytora w trybie oczekiwania pokazuje jego przedmioty i statystyki miesiąca — żeby czas oczekiwania nie był pusty i demotywujący.

**Decyzja:** Lewy panel strony rejestracji zawiera propozycję wartości + testimonial (social proof). Nie jest dekoracją — odpowiada na pytanie "czy to działa?" które każdy nowy użytkownik ma w głowie.

**Decyzja:** CTA "Nowe zlecenie" w sidebarze ucznia jako wyróżniony przycisk — zawsze widoczny niezależnie od aktualnego ekranu.

**Decyzja:** Toggle dostępności korepetytora umieszczony w sidebarze nad avatarem — to akcja zmieniająca stan globalny, blisko kontekstu tożsamości użytkownika. Nie w headerze treści.

## UX Copy — ton i zasady

*— do uzupełnienia w trakcie sesji —*

---

## Decyzje szczegółowe

### Onboarding — progressive disclosure

**Decyzja:** Dane płatności (uczeń) i dane profilu (korepetytor) nie są wymagane przy rejestracji. Użytkownik może założyć konto i eksplorować platformę. Dane wymagane są dopiero w momencie działania:
- Uczeń: musi podać dane płatności zanim wyśle pierwsze zlecenie
- Korepetytor: musi uzupełnić profil (przedmioty, poziomy, stawka) zanim włączy dostępność

**Uzasadnienie:** Zmniejsza barierę wejścia. Użytkownik w panice nie porzuci rejestracji przez formularz płatności, który pojawi się dopiero gdy już "wciągnął się" w platformę.

**Do rozwiązania w UX:** Jak i kiedy aplikacja komunikuje "musisz uzupełnić X zanim zrobisz Y"? Musi być jasny komunikat blokujący, nie ukryty błąd.

---

### Dashboard ucznia — zawartość

**Decyzja:** Dashboard ucznia zawiera trzy sekcje:
1. **Ostatnie sesje** — 5 ostatnich, każda klikalana → widok szczegółowy (notatki od nauczyciela; w przyszłości nagrania)
2. **Moje statystyki** — liczba sesji wg przedmiotu
3. **Dostępni korepetytorzy** — lista aktywnych korepetytorów, żeby uczeń widział czy ma sens składać zlecenie zanim je wyśle

**Uzasadnienie punktu 3:** Uczeń nie powinien czekać 5 minut tylko po to, żeby dowiedzieć się że nikt nie jest dostępny. Widoczność dostępności = zarządzanie oczekiwaniami przed złożeniem zlecenia.
