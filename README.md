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
2. Tworzysz zlecenie: wybierasz przedmiot, poziom, zakres i opisujesz temat
3. Platforma rozsyła zlecenie do dostępnych korepetytorów pasujących do przedmiotu — masz 5 minut
4. Pierwszy korepetytor, który zaakceptuje — wygrywa zlecenie
5. Dołączasz do sesji wideo i uczysz się
6. Po sesji oceniasz korepetytora (1–5 gwiazdek)

### Z perspektywy korepetytora

1. Rejestrujesz się i tworzysz profil: wybierasz przedmioty i poziomy nauczania, ustawiasz stawkę godzinową, opcjonalnie piszesz bio
2. Przechodzisz w tryb „dostępny" i czekasz na zlecenia
3. Widzisz przychodzące zlecenia w czasie rzeczywistym z licznikiem czasu
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
| Frontend + Backend | Next.js 16 (App Router) |
| Baza danych, autoryzacja, real-time | Supabase |
| Sesje wideo | Daily.co (w trakcie integracji) |
| Hosting | Vercel |
| Stylowanie | Tailwind CSS |
| Testy | Vitest |

---

## Status projektu

### Zaimplementowane

- [x] Autentykacja — rejestracja, logowanie, potwierdzenie email, reset hasła
- [x] Profile korepetytorów — przedmioty, poziomy nauczania, stawka godzinowa, bio
- [x] Zlecenia — składanie, real-time matching (polling + Supabase Realtime), wyścig między korepetytorami
- [x] Licznik czasu (5 minut) po obu stronach — uczeń i korepetytor
- [x] Auto-expiry — wygasłe zlecenia oznaczane automatycznie
- [x] Tworzenie sesji przy akceptacji — rekord w `sessions` gotowy pod integrację wideo
- [x] System oceniania — gwiazdki (1–5) + komentarz po zakończeniu sesji
- [x] Ekran startowy ucznia — statystyki, historia konsultacji, wykres aktywności
- [x] Dashboard korepetytora — toggle dostępności, zlecenia w czasie rzeczywistym, historia
- [x] Publiczny profil korepetytora — oceny, przedmioty, poziomy, stawka
- [x] Ustawienia konta — zmiana imienia i hasła
- [x] Panel administracyjny — MFA (TOTP), zarządzanie użytkownikami i konfiguracją platformy

### Do zrobienia

- [ ] Sesja wideo (Daily.co) — tabela `sessions` gotowa, brakuje integracji API
- [ ] Powiadomienia email — alert dla ucznia gdy korepetytor zaakceptuje, gdy minie czas zlecenia
- [ ] Płatności (Stripe) — ewidencja kwot w bazie istnieje, brak integracji bramki

### Poza zakresem MVP

- Automatyczne wypłaty dla korepetytorów
- Sesje zaplanowane na konkretny termin (tylko on-demand)
- Wiadomości między użytkownikami poza sesjami
- Weryfikacja korepetytorów / sprawdzanie tła
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
# Uzupełnij wartości z wyjścia `supabase start`

# Załaduj schemat bazy i dane testowe
npm run db:reset

# Uruchom serwer developerski
npm run dev
```

Aplikacja dostępna pod adresem [http://localhost:3000](http://localhost:3000).

### Konta testowe

| Email | Rola | Hasło |
|---|---|---|
| uczen1@test.pl | uczeń | TestTest1! |
| uczen2@test.pl | uczeń | TestTest1! |
| korepetytor1@test.pl | korepetytor (Matematyka, Fizyka) | TestTest1! |
| korepetytor2@test.pl | korepetytor (Chemia, Biologia) | TestTest1! |
| korepetytor3@test.pl | korepetytor (Angielski, Informatyka) | TestTest1! |

Dane konta admina ustawiane przez zmienne `ADMIN_EMAIL` / `ADMIN_PASSWORD` w `.env.local`.

---

## Kontekst

Projekt jest tworzony demonstracyjnie — pokazuje, jak można zbudować kompletną aplikację webową z pomocą AI, nawet bez wcześniejszego doświadczenia w programowaniu.
