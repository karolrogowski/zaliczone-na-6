# Analiza systemu oceniania i weryfikacji

To solidna, przemyślana podstawa. Widać, że myślałeś o manipulacji i nadużyciach. Poniżej moje szczegółowe przemyślenia — co jest mocne, co wymaga dopracowania, i kilka propozycji rozszerzeń.

---

## ✅ Co działa bardzo dobrze

**Waga ucznia (anty-trolling)** — jeden z najważniejszych mechanizmów. Mało platform to robi, a to kluczowa ochrona przed celowym zaniżaniem ocen przez złośliwych użytkowników.

**Decay czasowy ocen** — bardzo dojrzałe podejście. Korepetytor, który się poprawił, nie powinien "płacić" za błędy sprzed roku. To też motywuje do ciągłej pracy nad jakością.

**Domyślna ocena 5** — psychologicznie mądre. Eliminuje efekt "leniwego negatywu", gdzie ludzie oceniają tylko gdy są niezadowoleni.

**Powiązanie oceny z prowizją i pierwszeństwem powiadomień** — genialny mechanizm motywacyjny, bo ocena ma realną wartość ekonomiczną dla korepetytora, a nie jest tylko kosmetyczna.

---

## ⚠️ Rzeczy wymagające dopracowania

### 1. Wzór na wagę oceny — brakuje normalizacji

Twój obecny wzór:
```
wpływ = waga_ucznia × waga_czasu × waga_uzasadnienia × waga_admina
```

Problem: jak liczyć **końcową średnią ważoną**? To nie jest zwykła średnia — musisz zsumować `(ocena × wpływ)` i podzielić przez sumę samych `wpływów`:

```
Wynik = Σ(ocena_i × wpływ_i) / Σ(wpływ_i)
```

Bez dzielenia przez sumę wag, jeden korepetytor z 2 ocenami i drugi z 200 ocenami będą nieporównywalni.

---

### 2. Waga ucznia — jak dokładnie ją wyznaczasz?

To jest największa pułapka całego systemu. Mówisz *"jeśli daje cały czas niskie oceny"* — ale co to znaczy konkretnie? Kilka pytań:

- Czy "niska ocena" to 1–2, czy 1–3?
- Ile ocen musi wystawić zanim system zaczyna go oceniać? *(cold start problem — nowy uczeń nie ma historii)*
- Czy waga jest globalna (porównujesz ucznia do wszystkich uczniów) czy relatywna (porównujesz do jego własnej historii)?
- Co jeśli uczeń rzeczywiście trafia na złych korepetytorów? Jego waga spada, ale on ma rację

**Propozycja:** zamiast patrzeć tylko na to *jak nisko ocenia*, patrz na **odchylenie od mediany rynkowej** dla danego korepetytora. Jeśli korepetytor ma średnio 4.5, a jeden uczeń dał mu 1 — to podejrzane. Ale jeśli ten sam korepetytor ma średnio 2.1, to ta jedynka jest wiarygodna.

Możesz też liczyć wagę ucznia jako:

```
waga_ucznia = f(odchylenie od średniej rynkowej, liczba wystawionych ocen, % ocen 1-2)
```

---

### 3. Uzasadnienie przy niskiej ocenie — definicja "uzasadnionej"

Mówisz: *waga 0.5 jeśli nieuzasadniona*. Ale kto i jak weryfikuje, że uzasadnienie jest prawdziwe? Kilka scenariuszy:

- Uczeń pisze *"nie podobało mi się"* — czy to uzasadnienie? Technicznie tak.
- Uczeń pisze coś konkretnego, ale kłamie.
- Uczeń nie pisze nic — waga 0.5.

**Propozycja:** zamiast binarnego "uzasadnione/nie", wprowadź **minimalną długość uzasadnienia** (np. 50 znaków) i/lub **kategorię problemu** (spóźnienie, jakość materiałów, zachowanie, odwołanie zajęć). To ułatwia też analizę adminowi i daje korepetytorowi konkretny feedback.

---

### 4. Decay czasowy — zbyt agresywny?

Twoje wartości:
- 0 dni → waga 1.0
- 30 dni → waga 0.5
- 90 dni → waga 0.3
- 150 dni → waga 0.1

To dość agresywne — po 5 miesiącach ocena prawie nie istnieje. Dla korepetytora z małą liczbą ocen (np. 10 ocen przez rok) oznacza to, że jego "aktualny" wynik bazuje może na 2–3 ostatnich. To zbyt niestabilne.

**Propozycja:** rozważ **różne krzywe decay dla różnej liczby ocen**:
- Korepetytor z <20 ocenami: łagodniejszy decay (np. 0.8 po miesiącu)
- Korepetytor z >100 ocenami: można być agresywniejszym bo jest statystyczna stabilność

Albo zamiast twardych progów, użyj **funkcji wykładniczej**:
```
waga_czasu = e^(-λ × dni)
```
gdzie λ regulujesz w panelu admina.

---

### 5. Brak systemu oceny ucznia przez korepetytora

Mówisz, że korepetytor może napisać **zgłoszenie** do administracji, ale nie oceniać ucznia wprost. To świadoma decyzja? Bo w modelach takich jak Uber/Airbnb **obustronne ocenianie** jest kluczowe — korepetytor też powinien wiedzieć, z którym uczniem warto pracować.

Brak publicznej oceny ucznia może prowadzić do:
- Korepetytorzy nie mają narzędzia do odstraszania trudnych uczniów
- Administracja jest wąskim gardłem (każde zgłoszenie trzeba rozpatrzyć)
- Brak danych o uczniu utrudnia matching

**Propozycja:** prywatna ocena ucznia (widoczna tylko dla korepetytora, który już z nim pracował + admina). Korepetytor po zajęciach ocenia: *czy polecasz tego ucznia?* (np. kciuk w górę/dół + opcjonalny komentarz). Korepetytorzy, którzy odrzucili ucznia lub dali "kciuk w dół", mają możliwość blokowania go — co już masz. Ale te dane zbiorowe (np. 3 korepetytorów dało kciuk w dół) mogą automatycznie flagować konto ucznia do weryfikacji przez admina.

---

### 6. Cold start problem — nowi korepetytorzy

Nowy korepetytor = 0 ocen = brak wyniku = brak pierwszeństwa powiadomień. Może nigdy nie zebrać pierwszych ocen, bo nie dostaje zleceń.

**Propozycja:**
- Nowi korepetytorzy dostają **tymczasowy "boost" widoczności** na np. pierwsze 5 zleceń
- Mogą przejść **weryfikację manualną** (portfolio, dyplom, próbna lekcja z recenzją admina) która daje im startowy "trust score"
- Albo system **"verified new tutor"** badge widoczny dla uczniów, który sygnalizuje: *ta osoba jest nowa, ale zweryfikowana*

---

## 💡 Dodatkowe propozycje

### Mechanizm odwołania oceny

Co jeśli uczeń przez pomyłkę da 1 gwiazdkę zamiast 5 (fat finger na mobile)? Powinien być krótki **czas na edycję** (np. 15 minut od wystawienia). Po tym czasie ocena jest zamrożona — chyba że admin ją zmieni.

### Próg aktywacji ocen

Sugeruję, żeby korepetytor nie widział szczegółowych ocen dopóki nie ma ich przynajmniej 3–5. Wyświetlanie "masz 1 ocenę: 2 gwiazdki" jest demotywujące i niereprezentatywne. Zamiast tego: *"zbierasz pierwsze oceny"*.

### Podział oceny na kategorie

Zamiast jednej gwiazdki, rozważ **3 wymiary** (każdy 1–5):
- ⭐ Merytoryka (wiedza korepetytora)
- 📅 Organizacja (punktualność, przygotowanie)
- 💬 Komunikacja (sposób tłumaczenia, cierpliwość)

To daje korepetytorowi konkretny feedback *gdzie* się poprawić, a Ty masz bogatsze dane do rankingu.

### Automatyczne flagi

System powinien automatycznie flagować do admina sytuacje takie jak:
- Korepetytor dostał 3 oceny 1★ w ciągu 7 dni
- Ten sam uczeń wystawił ocenę 1★ więcej niż 3 różnym korepetytorą w miesiącu
- Nagły skok oceny (z 2.1 do 4.8) po małej liczbie nowych ocen

---

## Podsumowanie priorytetów

| Priorytet | Co zrobić |
|---|---|
| 🔴 Krytyczne | Doprecyzować wzór średniej ważonej (normalizacja przez sumę wag) |
| 🔴 Krytyczne | Zdefiniować algorytm wagi ucznia (cold start, co to "niska ocena") |
| 🟠 Ważne | Cold start dla nowych korepetytorów |
| 🟠 Ważne | Czas na edycję/cofnięcie błędnej oceny |
| 🟡 Warto rozważyć | Obustronne ocenianie (prywatna ocena ucznia) |
| 🟡 Warto rozważyć | Podział na kategorie oceny |
| 🟢 Nice to have | Automatyczne flagi dla admina |

System ma bardzo dobry fundament — szczególnie połączenie oceny z ekonomią (prowizja, pierwszeństwo) jest naprawdę przemyślane. Główna praca jest teraz w **operacjonalizacji** — czyli przełożeniu intuicyjnych reguł na konkretne liczby i algorytmy.


# Dopracowany system oceniania korepetytorów

Pełna specyfikacja systemu z wzorami, parametrami i wyjaśnieniami. Wszystkie wartości progowe podaję jako **propozycje wyjściowe** — należy je tunować na podstawie realnych danych po wdrożeniu.

---

## 1. Architektura ogólna

System składa się z **pięciu warstw**:

1. **Warstwa zbierania ocen** — UI po zajęciach, walidacja wejścia
2. **Warstwa wag** — obliczanie wagi pojedynczej oceny
3. **Warstwa agregacji** — średnia ważona dla korepetytora
4. **Warstwa decyzyjna** — przeliczenie wyniku na prowizję i pierwszeństwo powiadomień
5. **Warstwa nadzoru** — flagi anty-fraud, panel admina, audyt

---

## 2. Model danych — pojedyncza ocena

Każda ocena to obiekt z następującymi polami:

```
Rating {
  id
  tutor_id
  student_id
  lesson_id
  payment_confirmed: bool       // tylko zapłacone liczą się
  
  score_knowledge: 1..5         // merytoryka
  score_organization: 1..5      // organizacja, punktualność
  score_communication: 1..5     // komunikacja, cierpliwość
  
  justification_text: string    // opcjonalne uzasadnienie
  justification_category: enum  // kategoria problemu (jeśli ocena niska)
  
  created_at: timestamp
  editable_until: timestamp     // created_at + 15 min
  
  admin_weight: 0 | 0.5 | 1     // interwencja admina, domyślnie 1
  admin_note: string            // notatka admina (opcjonalna)
}
```

**Kluczowa zasada:** ocena jest tworzona tylko po **potwierdzonej płatności** za zajęcia. Inaczej `payment_confirmed = false` i ocena nie wchodzi do agregacji.

---

## 3. Trójwymiarowa ocena

Zamiast jednej gwiazdki, uczeń ocenia trzy wymiary (każdy 1–5, domyślnie 5):

| Wymiar | Co mierzy |
|---|---|
| **Merytoryka** | Wiedza, jakość wyjaśnień, zaawansowanie |
| **Organizacja** | Punktualność, przygotowanie materiałów, dotrzymywanie terminów |
| **Komunikacja** | Cierpliwość, sposób tłumaczenia, atmosfera |

**Ocena zagregowana** pojedynczej recenzji to średnia z trzech wymiarów:

$$S = \frac{S_{merit} + S_{org} + S_{komm}}{3}$$

Ta wartość $S \in [1, 5]$ trafia do dalszych obliczeń. Trzymanie trzech wymiarów osobno pozwala też:
- Pokazać korepetytorowi gdzie konkretnie traci punkty
- Robić ranking po pojedynczych wymiarach (np. *"najlepsi w organizacji"*)
- Lepiej dobierać korepetytorów do preferencji ucznia

---

## 4. Wzór na wagę pojedynczej oceny

$$w_i = w_{student} \cdot w_{time} \cdot w_{just} \cdot w_{admin}$$

gdzie:
- $w_{student}$ — wiarygodność ucznia ([0.1, 1.0])
- $w_{time}$ — decay czasowy ([0, 1])
- $w_{just}$ — uzasadnienie ([0.5, 1.0])
- $w_{admin}$ — interwencja admina (0, 0.5 lub 1)

Każdy element rozwijam poniżej.

---

### 4.1. Waga ucznia ($w_{student}$) — algorytm anty-trolling

**Cel:** zmniejszyć wpływ uczniów, którzy systematycznie zaniżają oceny w sposób niespójny z resztą rynku.

**Pomysł kluczowy:** waga ucznia bazuje na **odchyleniu jego ocen od ocen, które inni uczniowie wystawiają tym samym korepetytorom**. Jeśli uczeń ocenił trzech korepetytorów i wszyscy trzej mają średnio 4.5–4.8, a ten uczeń dał im 1–2, to sygnał manipulacji. Jeśli ich średnia to 2.0 i ten uczeń też dał 2, to spójność.

**Wzór:**

Dla każdej oceny ucznia $j$ wystawionej korepetytorowi $t$ obliczamy odchylenie:

$$d_{j,t} = S_{j,t} - \bar{S}_{t \setminus j}$$

gdzie $\bar{S}_{t \setminus j}$ to średnia ocen korepetytora $t$ **z wyłączeniem oceny ucznia $j$**.

Średnie odchylenie ucznia:

$$\bar{d}_j = \frac{1}{n_j} \sum_{t} d_{j,t}$$

gdzie $n_j$ = liczba ocen wystawionych przez ucznia $j$.

**Waga ucznia:**

$$w_{student}(j) = \begin{cases} 1.0 & \text{jeśli } n_j < n_{min} \text{ (cold start)} \\ \max\left(0.1, \; 1 + \alpha \cdot \bar{d}_j \cdot c(n_j)\right) & \text{w przeciwnym razie} \end{cases}$$

gdzie:
- $n_{min} = 3$ — minimalna liczba ocen do oceny wiarygodności
- $\alpha = 0.3$ — wrażliwość na odchylenie (parametr do tuningu)
- $c(n_j) = \min(1, n_j / 10)$ — **współczynnik pewności**: dla ucznia z 3 ocenami pewność jest niska, dla 10+ pewna

**Interpretacja:**
- Uczeń ocenia spójnie z rynkiem → $\bar{d}_j \approx 0$ → $w_{student} \approx 1.0$
- Uczeń systematycznie zaniża o 2 punkty → $\bar{d}_j = -2$ → $w_{student} = 1 + 0.3 \cdot (-2) \cdot 1 = 0.4$
- Uczeń zaniża o 3 punkty (skrajny troll) → $w_{student} = 1 + 0.3 \cdot (-3) = 0.1$ (floor)

**Asymetria — bardzo ważna:** ten wzór można zastosować **tylko dla odchyleń ujemnych**. Jeśli uczeń zawyża oceny ($\bar{d}_j > 0$), nie karzemy go — to nie jest problem dla systemu (ewentualnie inny mechanizm wykryje fake-positive zmowy, o tym w sekcji o flagach).

Modyfikacja:

$$w_{student}(j) = \max\left(0.1, \; 1 + \alpha \cdot \min(0, \bar{d}_j) \cdot c(n_j)\right)$$

**Cold start dla nowego ucznia:** dopóki $n_j < 3$, waga = 1.0, ale jego pierwsze oceny są oznaczane jako **"niezweryfikowane"** i admin widzi flagę przy korepetytorach, którzy dostali takie oceny niskie (≤2).

---

### 4.2. Waga czasu ($w_{time}$) — adaptacyjny decay

**Cel:** stare oceny tracą znaczenie, ale w tempie zależnym od **wolumenu ocen korepetytora** (żeby nie destabilizować małych próbek).

**Wzór wykładniczy:**

$$w_{time}(i, t) = e^{-\lambda(N_t) \cdot \Delta t_i}$$

gdzie:
- $\Delta t_i$ — wiek oceny w dniach
- $N_t$ — całkowita liczba ocen korepetytora $t$
- $\lambda(N_t)$ — adaptacyjna stała decay

**Adaptacyjna stała:**

$$\lambda(N_t) = \begin{cases} 0.003 & \text{jeśli } N_t < 20 \quad (\text{half-life} \approx 230 \text{ dni}) \\ 0.005 & \text{jeśli } 20 \le N_t < 100 \quad (\text{half-life} \approx 140 \text{ dni}) \\ 0.008 & \text{jeśli } N_t \ge 100 \quad (\text{half-life} \approx 87 \text{ dni}) \end{cases}$$

**Tabela wartości** (dla orientacji):

| Dni od oceny | $\lambda = 0.003$ | $\lambda = 0.005$ | $\lambda = 0.008$ |
|---|---|---|---|
| 0 | 1.00 | 1.00 | 1.00 |
| 30 | 0.91 | 0.86 | 0.79 |
| 90 | 0.76 | 0.64 | 0.49 |
| 180 | 0.58 | 0.41 | 0.24 |
| 365 | 0.33 | 0.16 | 0.05 |

**Asymetria opcjonalna:** możesz rozważyć, żeby **pozytywne oceny (≥4) miały wolniejszy decay** niż negatywne. To nagradza długotrwałą jakość, a złe oceny nie ciągną korepetytora w nieskończoność (zgodne z Twoją intuicją "złe oceny tracą na znaczeniu").

$$\lambda_{neg} = 1.5 \cdot \lambda_{pos}$$

W praktyce: jeśli ocena ≤ 3, używamy $\lambda$ z tabeli; jeśli ≥ 4, używamy $\lambda \cdot 0.7$ (wolniejszy decay).

---

### 4.3. Waga uzasadnienia ($w_{just}$)

**Reguły:**

| Ocena | Uzasadnienie | $w_{just}$ |
|---|---|---|
| $S \ge 4$ | Cokolwiek (lub brak) | 1.0 |
| $S < 4$ | Brak uzasadnienia | 0.5 |
| $S < 4$ | Tylko kategoria (dropdown) | 0.7 |
| $S < 4$ | Kategoria + tekst ≥50 znaków | 1.0 |
| $S < 4$ | Tylko tekst <50 znaków | 0.6 |

**Kategorie problemów** (dropdown przy ocenie <4):
- Spóźnienie / odwołanie zajęć
- Brak przygotowania / materiałów
- Niska jakość merytoryczna
- Problemy z komunikacją
- Niewłaściwe zachowanie
- Inne (wymagane tekst min. 50 znaków)

**Walidacja tekstu:** prosta — minimalna długość 50 znaków, blokada powtarzających się znaków (`aaaaa...`), opcjonalnie wykrywanie spam-patternów.

---

### 4.4. Waga admina ($w_{admin}$)

Trzy wartości: **0, 0.5, 1.0** (domyślnie 1).

Admin ustawia ją po przeglądnięciu zgłoszenia (od ucznia lub od korepetytora). Każda zmiana **wymaga notatki** w polu `admin_note` (dla audytu).

**Przypadki użycia:**
- $w_{admin} = 0$: jawna manipulacja, fake account, ocena za niezaistniałe zajęcia
- $w_{admin} = 0.5$: częściowo uzasadniona, ale są wątpliwości
- $w_{admin} = 1$: domyślnie

---

## 5. Średnia ważona korepetytora — formuła końcowa

$$\bar{S}_t = \frac{\sum_{i} S_i \cdot w_i}{\sum_{i} w_i}$$

gdzie:
- $S_i$ — zagregowana ocena z $i$-tej recenzji (średnia trzech wymiarów)
- $w_i$ — waga $i$-tej recenzji (z sekcji 4)

**Sumujemy po wszystkich ocenach** danego korepetytora (z `payment_confirmed = true`).

### Stabilizacja małych próbek — Bayesowska średnia

Korepetytor z 2 ocenami nie powinien być traktowany tak samo jak korepetytor ze 100 ocenami. Wprowadzamy **prior** — średnią globalną:

$$\bar{S}_t^{stab} = \frac{\sum_{i} S_i \cdot w_i + k \cdot \mu}{\sum_{i} w_i + k}$$

gdzie:
- $\mu$ — globalna średnia wszystkich ocen na platformie (np. 4.3)
- $k$ — siła priora (proponuję $k = 5$)

**Efekt:**
- Nowy korepetytor z 1 oceną 5★: $\bar{S} = (5 \cdot 1 + 5 \cdot 4.3) / (1 + 5) = 4.38$ (zamiast 5.0)
- Korepetytor z 50 ocenami średnio 4.7: $\bar{S} \approx 4.66$ (prior ma znikomy wpływ)

To naturalnie rozwiązuje cold start i chroni przed nadmiernym wpływem pojedynczych ocen.

---

## 6. Cold start dla nowych korepetytorów

Trzy mechanizmy, które działają **równolegle**:

### 6.1. Weryfikacja manualna przy rejestracji

Każdy nowy korepetytor przechodzi proces:

| Krok | Co weryfikujemy | Waga |
|---|---|---|
| Dokument tożsamości | Czy jest realną osobą | wymagane |
| Dyplom / certyfikat | Kompetencje | wymagane do nauczania |
| Profil tekstowy + zdjęcie | Jakość prezentacji | wymagane |
| Video-intro (opcja) | Bonus widoczności | opcjonalne |
| Próbna lekcja z weryfikatorem | Jakość pracy | opcjonalne (boost) |

Wynik weryfikacji manualnej daje **startowy trust score** $T_0 \in [0, 1]$, który wpływa na widoczność w cold start.

### 6.2. Boost widoczności

Nowi zweryfikowani korepetytorzy dostają **boost na pierwsze 5 zleceń**:
- Trafiają do pierwszego rzutu powiadomień **niezależnie od średniej**
- Mają oznaczenie **"Verified new tutor"** widoczne dla ucznia
- Po 5 zleceniach (lub 90 dniach) boost wygasa

### 6.3. Wynik wyświetlany — próg aktywacji

Publiczna ocena (gwiazdki) wyświetla się dopiero przy **min. 5 ocenach**. Wcześniej wyświetla się: *"Zbiera pierwsze opinie • zweryfikowany"*.

Wewnętrznie (do algorytmu prowizji i priorytetu) używamy średniej Bayesowskiej od początku.

---

## 7. Edycja oceny — okno czasowe

Po wystawieniu oceny uczeń ma **15 minut na edycję** (parametr konfigurowalny). Po tym czasie ocena jest **zamrożona** w bazie i nie może być edytowana — chyba że admin zmieni `admin_weight`.

UI powinno pokazać countdown: *"Możesz edytować ocenę jeszcze przez 14:23"*.

To zabezpieczenie przed:
- Błędem na mobile (kliknięcie 1 zamiast 5)
- Wyrzutem żalu (uczeń ocenił w emocjach, chce zmienić)

Ale jednocześnie nie pozwala na **manipulację po fakcie** (uczeń nie zmieni oceny tydzień później pod wpływem nacisku).

---

## 8. Mapowanie wyniku na prowizję platformy

Najprostszy model — **funkcja liniowa odwrotnie proporcjonalna** do oceny:

$$\text{prowizja}(\bar{S}_t) = P_{max} - (\bar{S}_t - 1) \cdot \frac{P_{max} - P_{min}}{4}$$

**Proponowane parametry:**
- $P_{max} = 25\%$ (dla oceny 1.0)
- $P_{min} = 10\%$ (dla oceny 5.0)

**Tabela:**

| Średnia | Prowizja |
|---|---|
| 1.0 | 25% |
| 2.0 | 21.25% |
| 3.0 | 17.5% |
| 4.0 | 13.75% |
| 4.5 | 11.88% |
| 5.0 | 10% |

**Alternatywa — progi:** możesz zrobić to schodkowo, co jest psychologicznie silniejsze (jasny cel: *"przekrocz 4.5 = niższa prowizja"*):

| Średnia | Prowizja | Status |
|---|---|---|
| ≥ 4.7 | 10% | Top Tutor |
| 4.3–4.69 | 15% | Trusted |
| 3.8–4.29 | 20% | Standard |
| < 3.8 | 25% | Probation |

Progi są łatwiejsze do komunikowania, ale tworzą efekt skoku przy granicy. Liniowa funkcja jest bardziej "sprawiedliwa" matematycznie. Wybór należy do Ciebie — ja bym poszedł w **progi** z powodów marketingowych (badge'y, status, gamifikacja).

---

## 9. Priorytet powiadomień — kolejka zleceń

Gdy uczeń wystawia zlecenie, system wysyła powiadomienia do korepetytorów w **rzutach**:

**Rzut 1 (natychmiast):** ulubieni korepetytorzy ucznia (jeśli pasują kategorią/przedmiotem)

**Rzut 2 (po 60 sek):** korepetytorzy z wynikiem priorytetu $P_t \ge 0.8$

**Rzut 3 (po 3 min):** $P_t \ge 0.5$

**Rzut 4 (po 7 min):** wszyscy pozostali, którzy pasują

**Wynik priorytetu:**

$$P_t = 0.6 \cdot \frac{\bar{S}_t - 1}{4} + 0.2 \cdot R_t + 0.1 \cdot A_t + 0.1 \cdot B_t$$

gdzie:
- $\bar{S}_t$ — średnia Bayesowska korepetytora
- $R_t \in [0,1]$ — response rate (jak często odpowiada na powiadomienia)
- $A_t \in [0,1]$ — acceptance rate (jak często akceptuje zlecenia po odpowiedzi)
- $B_t \in [0,1]$ — booster (1 dla nowych zweryfikowanych w cold start, 0 inaczej)

Wagi (0.6, 0.2, 0.1, 0.1) są do tuningu.

**Wyłączenia:**
- Korepetytor, którego uczeń dodał do "nie chcę pracować" → **nie dostaje powiadomienia w ogóle**
- Korepetytor, który dodał ucznia do "nie chcę pracować" → **nie dostaje powiadomienia w ogóle**

---

## 10. System obustronnego oceniania (prywatna ocena ucznia)

Korepetytor po zajęciach widzi szybki formularz:

```
Czy polecasz tego ucznia innym korepetytorom?
  👍 Tak
  😐 Neutralnie
  👎 Nie

Opcjonalny komentarz (widoczny tylko dla Ciebie i adminów): _______
```

Plus checkbox **"Nie chcę więcej ofert od tego ucznia"** (już masz).

**Co robimy z tymi danymi:**

1. **Trust score ucznia** $T_s \in [0, 1]$ — wykorzystywany przy decyzji o priorytecie matchowania, oraz jako jeden z sygnałów do flagi anty-fraud.

$$T_s = \frac{liczba\_kciuków\_w\_górę + 0.5 \cdot neutralnych}{liczba\_wszystkich\_ocen\_korepetytorów}$$

Uczeń nie widzi swojego trust score — to dane wewnętrzne.

2. **Auto-flagi:** jeśli ≥3 korepetytorów dało "kciuk w dół" temu samemu uczniowi w ciągu 30 dni → flaga do admina.

3. **Dopasowanie:** uczniowie z bardzo niskim $T_s$ mają obniżony priorytet w kolejce matchingowej dla nowych korepetytorów (chronimy ich przed trudnymi klientami na start).

---

## 11. Automatyczne flagi anty-fraud

System monitoruje wzorce i flaguje do panelu admina:

| Flaga | Trigger | Priorytet |
|---|---|---|
| **Wysyp negatywów** | Korepetytor: 3+ ocen ≤2 w 7 dni | wysoki |
| **Wysyp pozytywów** | Korepetytor: 5+ ocen 5★ w 24h od nowych kont | wysoki (fake) |
| **Skoczek** | Średnia skok ≥1.5 punkta w 14 dni | średni |
| **Trolla ucznia** | Uczeń: 3+ ocen ≤2 różnym korepetytorom w 30 dni | średni |
| **Conflict** | Uczeń ocenił 1★ + korepetytor zgłosił ucznia | wysoki |
| **Self-rating** | Korelacja IP/urządzenia ucznia i korepetytora | krytyczny |
| **Zerowy decay** | Korepetytor nie ma ocen ≥90 dni mimo zleceń | niski |

Każda flaga ląduje w **panelu admina** z propozycją akcji (zmień `admin_weight`, zablokuj konto, kontakt manualny).

---

## 12. Podsumowanie wzorów — jednostronicowa ściąga

**Pojedyncza ocena:**
$$S_i = \frac{S_{merit} + S_{org} + S_{komm}}{3}$$

**Waga oceny:**
$$w_i = w_{student} \cdot w_{time} \cdot w_{just} \cdot w_{admin}$$

**Waga ucznia:**
$$w_{student} = \max\left(0.1, \; 1 + 0.3 \cdot \min(0, \bar{d}_j) \cdot \min(1, n_j/10)\right)$$

**Waga czasu:**
$$w_{time} = e^{-\lambda(N_t) \cdot \Delta t}$$

**Średnia ważona (Bayesowska):**
$$\bar{S}_t = \frac{\sum_{i} S_i \cdot w_i + 5 \cdot \mu}{\sum_{i} w_i + 5}$$

**Priorytet powiadomień:**
$$P_t = 0.6 \cdot \frac{\bar{S}_t - 1}{4} + 0.2 \cdot R_t + 0.1 \cdot A_t + 0.1 \cdot B_t$$

**Prowizja (progi):** 10% / 15% / 20% / 25% w zależności od $\bar{S}_t$.

---

## 13. Parametry do tuningu — checklist

Wszystkie te wartości powinny być **w bazie danych jako konfiguracja**, nie hardkodowane:

| Parametr | Propozycja | Zakres tuningu |
|---|---|---|
| $\alpha$ (wrażliwość wagi ucznia) | 0.3 | 0.1–0.5 |
| $n_{min}$ (min. ocen do oceny ucznia) | 3 | 2–5 |
| $\lambda$ (decay – małe próbki) | 0.003 | 0.001–0.005 |
| $\lambda$ (decay – duże próbki) | 0.008 | 0.005–0.012 |
| $k$ (siła priora Bayesowskiego) | 5 | 3–10 |
| $\mu$ (globalna średnia) | ~4.3 | obliczana z danych |
| Próg aktywacji publicznej oceny | 5 ocen | 3–10 |
| Okno edycji oceny | 15 min | 5–60 min |
| Czas boost nowego korepetytora | 5 zleceń / 90 dni | tunable |
| Liczba rzutów powiadomień | 4 | 3–5 |
| Opóźnienie rzutów | 60s / 3min / 7min | tunable |

---

## Kolejne kroki, które polecam

1. **Zaimplementować logikę "naive"** — bez wagi ucznia, bez decay, prosta średnia ważona z `admin_weight` i `justification_weight`. Wypuść MVP.

2. **Zbierać dane przez 2–3 miesiące** — bez aktywnego algorytmu wagi ucznia (potrzebne do skalibrowania $\bar{d}_j$).

3. **Włączyć decay i wagę ucznia** dopiero gdy są dane do walidacji parametrów.


4. **Stworzyć panel admina** z metrykami: rozkład średnich, rozkład wag, top flagowani użytkownicy, średnia globalna $\mu$ aktualizowana co tydzień.
5. **A/B test progów prowizji vs liniowa funkcja** — który model lepiej motywuje korepetytorów.

Chcesz, żebym rozwinął któryś z tych elementów głębiej? Mogę na przykład rozpisać dokładny pseudokod algorytmu wagi ucznia, schemat bazy danych, albo wireframe UI dla uczeń+korepetytor po zajęciach.