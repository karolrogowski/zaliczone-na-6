# Zaliczone na 6

> Korepetycje on-demand. Znajdź korepetytora w kilka minut — nawet wieczorem przed klasówką.

---

## Pomysł w jednym zdaniu

Wyobraź sobie, że jest godzina 21:40. Masz jutro klasówkę i właśnie zdajesz sobie sprawę, że nie ogarniasz materiału. Otwierasz aplikację, opisujesz czego potrzebujesz, płacisz — i za chwilę jesteś w sesji wideo z korepetytorem, który jest dostępny właśnie teraz.

To jest **Zaliczone na 6** — Uber dla korepetycji.

---

## Jak to działa

### Z perspektywy ucznia

1. Rejestrujesz się i logujesz
2. Tworzysz zlecenie: wybierasz przedmiot, opisujesz temat, wybierasz czas (30 lub 60 minut)
3. Platforma rozsyła zlecenie do dostępnych korepetytorów pasujących do przedmiotu
4. Pierwszy korepetytor, który zaakceptuje — wygrywa zlecenie
5. Dołączasz do sesji wideo i uczysz się
6. Po sesji oceniasz korepetytora

### Z perspektywy korepetytora

1. Rejestrujesz się i tworzysz profil: wybierasz przedmioty, które uczysz, piszesz krótkie bio
2. Przechodzisz w tryb "dostępny" i czekasz na zlecenia
3. Widzisz przychodzące zlecenia pasujące do Twoich przedmiotów w czasie rzeczywistym
4. Akceptujesz zlecenie i dołączasz do sesji wideo
5. Po sesji system zapisuje Twoje zarobki — wypłata następuje poza aplikacją

---

## Model biznesowy

Platforma pobiera prowizję od każdej sesji. Uczeń płaci pełną kwotę, korepetytor otrzymuje kwotę pomniejszoną o prowizję. W MVP płatności są obsługiwane ręcznie — system ewidencjonuje kwoty, a rozliczenia odbywają się poza aplikacją.

```
Sesja 60 min = 90 zł
Korepetytor dostaje: 72 zł → Platforma zarabia: 18 zł (20% prowizji)
```

---

## Stack technologiczny

| Warstwa | Technologia |
|---|---|
| Frontend + Backend | Next.js (App Router) |
| Baza danych, autoryzacja, real-time | Supabase |
| Sesje wideo | Daily.co |
| Hosting | Vercel |
| Stylowanie | Tailwind CSS |

Wybory podyktowane jednym kryterium: **darmowe plany + łatwe wdrożenie**. To MVP, a nie produkcja na milion użytkowników.

---

## Status projektu

Projekt jest w trakcie budowania MVP. Celem MVP jest pokazanie kompletnej ścieżki biznesowej — od zlecenia ucznia do wypłaty dla korepetytora — a nie wdrożenie każdej możliwej funkcji.

### W zakresie MVP
- [x] Specyfikacja i architektura
- [x] Inicjalizacja projektu
- [ ] Autentykacja (logowanie / rejestracja)
- [ ] Profile korepetytorów
- [ ] Tworzenie i rozsyłanie zleceń w czasie rzeczywistym
- [ ] Sesja wideo (30 / 60 minut)
- [ ] Ewidencja finansowa (kwoty, prowizja)
- [ ] System oceniania

### Poza zakresem MVP
- Integracja bramki płatności — płatności obsługiwane ręcznie przez administratora
- Automatyczne wypłaty dla korepetytorów
- Sesje zaplanowane na konkretny termin (tylko on-demand)
- Wiadomości między użytkownikami poza sesjami
- Weryfikacja korepetytorów / sprawdzanie tła
- Panel administracyjny
- Aplikacje mobilne

---

## Uruchomienie lokalnie

### Wymagania
- Node.js 18+
- Docker (dla lokalnej instancji Supabase)

### Kroki

```bash
# Instalacja zależności
npm install

# Uruchom Supabase lokalnie
npx supabase start

# Skopiuj zmienne środowiskowe
cp .env.local.example .env.local
# Uzupełnij wartości w .env.local

# Uruchom serwer developerski
npm run dev
```

Aplikacja dostępna pod adresem [http://localhost:3000](http://localhost:3000).

---

## Decyzje architektoniczne

Dokumentacja decyzji architektonicznych znajduje się w [`docs/adr/`](docs/adr/).

---

## Kontekst

Projekt jest tworzony demonstracyjnie — pokazuje, jak można zbudować kompletną aplikację webową z pomocą AI, nawet bez wcześniejszego doświadczenia w danej technologii.
