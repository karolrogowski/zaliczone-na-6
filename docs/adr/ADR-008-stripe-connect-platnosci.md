# ADR-008: Stripe Connect jako mechanizm płatności

**Status:** Zaakceptowany  
**Data:** 2026-06-03  
**Zastępuje:** [ADR-004](ADR-004-brak-bramki-platnosci-w-mvp.md)

## Kontekst

MVP zostało zwalidowane. Platforma potrzebuje teraz prawdziwego mechanizmu płatności: uczeń płaci za sesję, platforma pobiera 30% prowizji, korepetytor dostaje 70%.

Przebadano następujące opcje: Stripe Connect, PayU Marketplace, Przelewy24 Marketplace, Tpay Marketplace. Szczegółowe zestawienie w `docs/payment-research.md`.

Dodatkowe ograniczenie prawne: prowadzenie własnego portfela (przechowywanie środków użytkowników) bez licencji KNF jest nielegalne w Polsce — grozi karą do 5 mln zł. Rozwiązanie musi delegować przechowywanie środków do licencjonowanego operatora.

## Decyzja

Używamy **Stripe Connect (Express accounts)** jako jedynego mechanizmu płatności.

Model przepływu pieniędzy:
1. Uczeń płaci przez Stripe (karta lub BLIK) — **preautoryzacja** (`capture_method: manual`) w momencie złożenia zlecenia
2. Jeśli nikt nie zaakceptuje zlecenia — Stripe anuluje blokadę bez pobierania środków
3. Po zakończeniu sesji — platforma wywołuje `capture()`, następnie `transfer()` 70% na konto korepetytora
4. Korepetytor zleca wypłatę z salda Stripe na swoje konto bankowe kiedy chce

Portfel korepetytora jest prowadzony przez Stripe (na licencji Stripe Payments Europe Ltd.) — nie przez platformę.

Dane kart nigdy nie trafiają na serwery platformy — używamy Stripe Elements. Kwalifikujemy się do PCI DSS SAQ-A.

## Uzasadnienie

**Dlaczego Stripe, nie PayU / Przelewy24:**
- Stripe Connect obsługuje KYC korepetytorów samodzielnie (Express Onboarding) — platforma nie musi zbierać ani przechowywać dokumentów tożsamości
- Stripe jest dostępny od ręki przez dashboard bez podpisywania umów (PayU/Przelewy24 wymagają kilku tygodni)
- Najlepsza dokumentacja i ekosystem narzędzi (Stripe CLI, webhooks, test mode)
- BLIK obsługiwany natywnie od 2023, wysoka konwersja (~93–95%)
- Stripe obsługuje PLN i wypłaty na polskie konta bankowe

**Dlaczego preautoryzacja, nie płatność od razu:**
- Uczeń nie powinien płacić zanim korepetytor zaakceptuje zlecenie — brak akceptacji = brak opłaty
- Preautoryzacja (`PaymentIntent` z `capture_method: manual`) blokuje środki na karcie bez pobierania
- Maksymalny czas blokady kart: 7 dni (Visa/Mastercard) — wystarczający dla modelu platformy

**Dlaczego Express accounts dla korepetytorów:**
- Stripe przejmuje odpowiedzialność za weryfikację tożsamości (KYC/AML)
- Platforma nie musi być licencjonowanym dostawcą usług płatniczych
- Korepetytor ma swój panel w Stripe z historią wypłat

## Konsekwencje

**Pozytywne:**
- Brak obowiązku uzyskiwania licencji KNF (Stripe jest licencjonowany)
- Brak przechowywania danych kart — minimalna powierzchnia ataku
- Stripe obsługuje spory, zwroty, weryfikacje 3D Secure
- Gotowe środowisko testowe (test mode, testowe karty, testowy BLIK)

**Negatywne / ryzyka:**
- Stripe pobiera prowizję od każdej transakcji (~1,2–1,5% + 0,25€ + 0,25% od transferu Connect)
- Zagraniczna firma — część korepetytorów może mieć obawy; akceptowalne ryzyko na tym etapie
- Stripe może zablokować konto platformy lub connected account przy podejrzeniu fraudu — potrzebna polityka obsługi takich przypadków
- Wypłaty dla korepetytorów przez Stripe Express Dashboard — brak pełnej kontroli UX tego ekranu

**Odrzucone alternatywy:**
- Własny portfel (e-money) — wymaga licencji KNF, zbyt kosztowne na tym etapie
- Mała Instytucja Płatnicza (MIP) — limit 1,5 mln EUR/mies., wymogi organizacyjne, nie uzasadnione przy obecnej skali
- PayU Marketplace — dobra alternatywa, ale dłuższy onboarding platformy i brak przejęcia KYC korepetytorów
- Przelewy24 Marketplace — podobne wady jak PayU

## Reguły biznesowe (ustalone 2026-06-08)

- **Cena sesji:** 100 zł, stała dla wszystkich sesji; konfigurowalna przez admina w `platform_config`
- **Prowizja platformy:** 30% (potwierdzone 2026-06-12); wartość czytana z `platform_config.commission_pct` przy każdym podziale — admin może ją zmieniać w panelu bez deployu. Wcześniejsza wartość 20 w seedzie była nieużywanym placeholderem.
- **Czas trwania:** tylko 60 minut (brak opcji 30 min na tym etapie)
- **Timing płatności:** preautoryzacja (hold) w momencie złożenia zlecenia przez ucznia; faktyczne pobranie (`capture`) po zakończeniu sesji
- **Sesja skrócona przez korepetytora:** pobierana pełna opłata — korepetytor nie powinien kończyć wcześniej
- **Problemy techniczne / reklamacje:** brak automatycznych zwrotów; uczeń zgłasza problem przez ocenę lub kontakt z adminem; admin manualnie decyduje o zwrocie w panelu
- **Mechanizm anty-nadużycia:** admin ocenia wiarygodność zgłoszenia; ryzyko fałszywych reklamacji akceptowane na obecnym etapie

## Plan implementacji

Szczegółowy plan w `docs/payment-implementation-plan.md` — 10 kroków, każdy kończy się testami E2E.

Skrócona kolejność:
1. Konfiguracja Stripe (klucze, webhook endpoint)
2. Migracja bazy (`stripe_payment_intent_id`, `stripe_account_id` itp.)
3. PaymentIntent + formularz Stripe Elements
4. Webhooks → aktualizacja statusów
5. Preautoryzacja: capture po sesji, cancel przy braku korepetytora
6. Onboarding korepetytora (Express)
7. Split payment (transfer 70%)
8. Saldo i wypłata
9. Zwroty (admin)
