# Research: Mechanizm płatności dla platformy korepetycji

## Kontekst i pytania wyjściowe

Platforma działa jak marketplace: uczeń płaci za sesję, platforma pobiera prowizję (30%), korepetytor dostaje resztę. Pytania do rozstrzygnięcia:

1. Czy możemy prowadzić portfel dla korepetytora bez bycia bankiem?
2. Jakie opcje płatnościowe wchodzą w grę?
3. Jakie są konsekwencje prawne i implementacyjne każdej opcji?
4. Jak przetestować płatności zanim wejdziemy na produkcję?

---

## 1. Portfel korepetytora — czy to legalne bez licencji?

### Krótka odpowiedź: nie możesz prowadzić portfela samodzielnie.

Przechowywanie środków pieniężnych innych osób i zarządzanie nimi to usługa płatnicza regulowana przez polską Ustawę o usługach płatniczych (implementacja dyrektywy PSD2). Bez licencji KNF nie możesz:

- trzymać pieniędzy uczniów w "saldie" na platformie przed sesją,
- trzymać pieniędzy korepetytorów w "portfelu" przed wypłatą.

Naruszenie grozi karą do 5 mln zł lub pozbawieniem wolności do 2 lat.

### Dwie legalne ścieżki dla małej platformy:

**Ścieżka A — Mała Instytucja Płatnicza (MIP):**
Uproszczona rejestracja w KNF (nie jest to pełna licencja, tylko wpis do rejestru). Pozwala prowadzić usługi płatnicze do limitu 1,5 mln EUR miesięcznie. Wymaga jednak spełnienia wymogów organizacyjnych i proceduralnych — realny koszt wdrożenia dla startupu to kilka–kilkanaście tysięcy złotych (obsługa prawna) plus czas.

**Ścieżka B — Delegacja do licencjonowanego dostawcy (zalecana):**
Nie prowadzisz portfela samodzielnie — zamiast tego korepetytor zakłada konto bezpośrednio u licencjonowanego operatora (np. Stripe, PayU), który przechowuje środki. Ty jedynie instruujesz operatora jak podzielić płatność. To jest standardowy model dla marketplace'ów i jest w pełni legalny. Stripe, PayU i Przelewy24 mają własne licencje — problem prawny spada na nich.

**Wniosek: wybierz Ścieżkę B.** Portfel korepetytora istnieje — ale jest prowadzony przez Stripe/PayU, nie przez Ciebie. Korepetytor loguje się do swojego konta u operatora i zleca wypłatę na konto bankowe. Dla użytkownika wygląda to identycznie jak "portfel w aplikacji" — po prostu backend jest zewnętrzny.

---

## 2. Bezpieczeństwo danych kart — PCI DSS

PCI DSS to standard bezpieczeństwa wymagany przez sieci kartowe (Visa, Mastercard). Jeśli dane karty (numer, CVV, data ważności) kiedykolwiek przelatują przez Twój serwer — podlegasz surowym wymaganiom technicznym i audytom.

### Jak tego uniknąć (i powinieneś):

Wszystkie nowoczesne dostawcy (Stripe, PayU, Przelewy24) oferują rozwiązanie gdzie dane karty trafiają bezpośrednio z przeglądarki użytkownika na serwery dostawcy — Twój serwer widzi tylko **token** (np. `pm_abc123`), nigdy rzeczywisty numer karty.

Przy takim podejściu kwalifikujesz się do **SAQ-A** — najprostszej formy samooceny PCI DSS, której możesz dokonać sam bez audytora. Obowiązek ochrony danych kart spoczywa na dostawcy, który ma certyfikat PCI DSS Level 1.

**Zasada:** nigdy nie pisz własnych formularzy zbierających numer karty. Zawsze używaj gotowych komponentów dostawcy (Stripe Elements, PayU widget).

---

## 3. Opcje płatnościowe — porównanie

### Opcja A: Stripe + Stripe Connect

**Co to jest:** Globalna platforma płatności z osobnym produktem dla marketplace'ów (Stripe Connect). Stripe jest licencjonowanym dostawcą usług płatniczych w UE.

**Metody płatności:** karty Visa/Mastercard, BLIK (natywnie od 2023, ~93–95% konwersji), Apple Pay, Google Pay, przelewy bankowe.

**Jak działa podział płatności:**
1. Uczeń płaci np. 100 zł przez Stripe.
2. Stripe automatycznie przekazuje 70 zł na konto korepetytora (jego "Connected Account"), 30 zł trafia na konto platformy.
3. Korepetytor zleca wypłatę z panelu Stripe na swoje konto bankowe (lub dzieje się to automatycznie co tydzień).

**Onboarding korepetytora (KYC):** Stripe obsługuje weryfikację tożsamości korepetytora samodzielnie — korepetytor przechodzi przez Stripe Express Onboarding (formularz w języku polskim), podaje PESEL lub dane paszportu, Stripe weryfikuje. Ty nie musisz zbierać ani przechowywać dokumentów tożsamości.

**Kwestie prawne:**
- Dane kart: Stripe przechowuje, Ty nie — PCI SAQ-A.
- Portfel korepetytora: prowadzi go Stripe na licencji Stripe Payments Europe Ltd.
- Prowizja platformy: musisz rozliczać VAT od prowizji jak od każdej usługi; wypłaty dla korepetytorów to ich przychód — wystawiają faktury lub rozliczają się w US/PIT.

**Kwestie implementacyjne:**
- Dobrze udokumentowane API w języku angielskim.
- Biblioteki: `stripe-js` (frontend), `stripe` (Node.js backend — działa w Next.js API Routes / Server Actions).
- Preautoryzacja (zamrożenie środków): `PaymentIntent` z `capture_method: manual` — Stripe blokuje kwotę na karcie, dopiero po zakończeniu sesji wywołujesz `capture()`. To mechanizm "hold funds".
- Webhooks: Stripe wysyła zdarzenia na Twój endpoint gdy płatność się powiedzie, zakończy sesja itp.

**Model wypłat dla korepetytora:** balance w Stripe → automatyczna lub manualna wypłata na konto bankowe (czas: 1–2 dni robocze dla PLN).

**Cennik:** ~1,5% + 0,25€ dla kart europejskich; BLIK: 1,2% + 0,25€. Stripe Connect pobiera dodatkowo 0,25% od każdego transferu do connected account.

**Środowisko testowe:** pełny tryb testowy (test mode) — testowe numery kart (np. `4242 4242 4242 4242`), testowe kody BLIK, testowe webhooki. Pełna parytacja funkcji z produkcją.

---

### Opcja B: PayU (polska firma, marka PayU Poland)

**Co to jest:** Jeden z największych polskich operatorów płatności, licencjonowany przez KNF. Posiada dedykowany produkt Marketplace.

**Metody płatności:** karty, BLIK (z integracją token — OneClick BLIK), przelewy natychmiastowe, raty.

**Jak działa podział płatności:**
- PayU Marketplace umożliwia rejestrację podsprzedawców (korepetytorów) i automatyczny podział płatności.
- Komisja platformy konfigurowana po stronie PayU.

**Kwestie prawne:**
- PayU jest KIP (Krajowa Instytucja Płatnicza) z licencją KNF — model prawny podobny jak Stripe.
- Polskie przepisy, lepsza znajomość lokalnych wymogów KYC.

**Kwestie implementacyjne:**
- API REST, dokumentacja po angielsku, integracja nieco bardziej złożona niż Stripe.
- Wymaga podpisania umowy z PayU i oddzielnego procesu onboardingu dla platformy (dłuższy niż przy Stripe).
- OneClick BLIK (zapamiętany token) wymaga dodatkowej integracji.

**Model wypłat:** podobny do Stripe — saldo subkonta → wypłata na konto bankowe.

**Środowisko testowe:** sandbox dostępny.

---

### Opcja C: Przelewy24

**Co to jest:** Polska bramka płatności (spółka zależna PayPro SA), mocna pozycja w polskim e-commerce.

**Metody płatności:** przelewy natychmiastowe z ~20 banków, BLIK, karty, Google Pay.

**Jak działa podział płatności:**
- Przelewy24 Marketplace: obsługa podsprzedawców ze split payment.
- subMerchantId identyfikuje korepetytora przy każdej transakcji.

**Kwestie prawne:**
- Polski operator z licencją KNF.
- Sprawdzone dla polskiego rynku.

**Kwestie implementacyjne:**
- REST API, polska dokumentacja.
- Onboarding podsprzedawcy wymaga rejestracji i weryfikacji po stronie Przelewy24.
- Integracja dojrzała, ale ekosystem narzędzi deweloperskich słabszy niż Stripe.

**Model wypłat:** saldo korepetytora → wypłata na konto bankowe.

**Środowisko testowe:** sandbox dostępny.

---

### Opcja D: Tpay

**Co to jest:** Polski operator (Krajowy Integrator Płatności SA), obecny na rynku od 10+ lat.

**Metody płatności:** karty, BLIK, przelewy natychmiastowe, krypto (nieistotne tutaj).

**Jak działa podział płatności:**
- Tpay Marketplace — konfiguracja subkont i podziału prowizji przez API.

**Kwesties prawne:** analogicznie jak PayU i Przelewy24 — polski KIP z licencją KNF.

**Kwesties implementacyjne:**
- API REST.
- Dokumentacja po polsku i angielsku.
- Mniejszy ekosystem integracji niż Stripe/PayU.

**Środowisko testowe:** środowisko testowe dostępne.

---

## 4. Rekomendacja

**Stripe Connect** jest najlepszym wyborem dla tej platformy na etapie startupu, z następujących powodów:

| Kryterium | Stripe Connect | PayU Marketplace | Przelewy24 |
|---|---|---|---|
| BLIK | Natywny | Tak | Tak |
| KYC korepetytora | Stripe przejmuje (Express) | Własna weryfikacja | Własna weryfikacja |
| Onboarding platformy | Automatyczny, przez dashboard | Umowa, kilka tygodni | Umowa, kilka tygodni |
| Preautoryzacja (hold) | Wbudowana (`capture_method: manual`) | Dostępna | Dostępna |
| Jakość sandbox | Bardzo dobra (parytacja produkcji) | Dobra | Dobra |
| Dokumentacja | Najlepsza w branży | Dobra | Średnia |
| Czas wdrożenia | Najkrótszy | Dłuższy | Dłuższy |

Minusem Stripe jest to, że to firma zagraniczna — część korepetytorów może mieć obawy co do zagranicznego podmiotu obsługującego ich wypłaty. Jeśli to będzie problem, PayU jest dobrą alternatywą.

---

## 5. Model przepływu pieniędzy (jak by to działało)

```
Uczeń
  │
  │  płaci 120 zł (karta / BLIK)
  ▼
Stripe (trzyma środki)
  │
  │  po zakończeniu sesji:
  ├─► 84 zł → saldo korepetytora (konto u Stripe)
  └─► 36 zł → saldo platformy (Twoje konto u Stripe)
                       │
                       └─► Twój rachunek bankowy (codziennie/tygodniowo)

Korepetytor
  │
  └─► wypłaca z Stripe na swoje konto bankowe kiedy chce
       (lub automatycznie co tydzień)
```

Wariant z preautoryzacją (przed sesją):

```
1. Uczeń klika "Szukaj korepetytora" → Stripe blokuje 120 zł na karcie (hold)
2. Korepetytor akceptuje zlecenie
3. Sesja trwa 30 min
4. Sesja kończy się → wywołujesz capture() → 120 zł zostaje pobrane
5. Stripe rozbija na 84 zł + 36 zł
6. Jeśli nikt nie zaakceptuje zlecenia → wywołujesz cancel() → blokada opada
```

---

## 6. Jak testować przed produkcją

### Stripe (zalecane)

Stripe ma tryb testowy w pełni odizolowany od produkcji — klucze testowe zaczynają się od `sk_test_...`. Żadne prawdziwe pieniądze nie są ruszane.

**Testowe karty:**
- `4242 4242 4242 4242` — karta zawsze płaci
- `4000 0000 0000 9995` — karta zawsze odrzuca (brak środków)
- `4000 0025 0000 3155` — karta wymaga 3D Secure
- `4000 0000 0000 0341` — karta zawsze odrzuca (zdecyduj data: dowolna, CVV: dowolny)

**Testowe BLIK:** Stripe udostępnia specjalny testowy "bank" w Stripe.js — wpisujesz dowolny 6-cyfrowy kod i wybierasz wynik (sukces/błąd).

**Testowy onboarding korepetytora:** w trybie testowym Stripe Express Onboarding jest skrócony — podajesz testowe dane, bez prawdziwej weryfikacji.

**Testowe webhooki:** `stripe listen --forward-to localhost:3000/api/webhooks/stripe` (CLI Stripe) przekierowuje zdarzenia ze Stripe na lokalny serwer.

### Kolejność wdrożenia (bezpieczna ścieżka)

1. **Etap 1 — sandbox:** cała integracja z kluczami `sk_test_...`. Prawdziwi korepetytorzy z testowymi kontami Stripe. Żadne realne pieniądze.
2. **Etap 2 — beta zamknięta:** kilku prawdziwych użytkowników z prawdziwymi kluczami `sk_live_...`, ale ręcznie monitorujesz każdą transakcję.
3. **Etap 3 — produkcja:** po kilku tygodniach bez incydentów otwierasz szerzej.

---

## 7. Co zrobić przed implementacją (checklista)

- [ ] Założyć konto Stripe (jako firma lub JDG)
- [ ] Przejść przez Stripe Connect onboarding dla platformy (zatwierdzenie przez Stripe — zwykle 1–2 dni)
- [ ] Podjąć decyzję: automatyczne wypłaty dla korepetytorów co tydzień, czy manualne?
- [ ] Podjąć decyzję: preautoryzacja przed sesją, czy pobieranie po sesji?
- [ ] Skonsultować z księgowym/prawnikiem model prowizji (VAT od prowizji platformy, obowiązki informacyjne wobec korepetytorów)
- [ ] Zaplanować obsługę refundacji (co jeśli korepetytor nie dotrze na sesję?)

---

## Źródła

- [Stripe BLIK — strona metody płatności](https://stripe.com/payment-method/blik)
- [Stripe Connect — dokumentacja](https://docs.stripe.com/connect)
- [Stripe BLIK — dokumentacja integracji](https://docs.stripe.com/payments/blik/accept-a-payment)
- [Stripe — płatności w Polsce](https://stripe.com/resources/more/payments-in-poland)
- [Stripe — PCI DSS compliance](https://stripe.com/guides/pci-compliance)
- [PayU Marketplace](https://poland.payu.com/our-solutions/marketplace/)
- [PayU BLIK](https://poland.payu.com/all-payment-solutions/blik-payments/)
- [Przelewy24 Marketplace](https://www.przelewy24.pl/en/payment-solutions/marketplace)
- [KNF — dostawcy usług płatniczych](https://www.knf.gov.pl/dla_rynku/procesy_licencyjne/platniczy/informacje_ogolne/dostawcy_uslug_platniczych)
- [KNF — Mała Instytucja Płatnicza (przewodnik)](https://legalgeek.pl/blog/mip-przewodnik-mala-instytucja-platnicza/)
