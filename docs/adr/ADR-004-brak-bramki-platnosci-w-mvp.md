# ADR-004: Brak integracji bramki płatności w MVP

**Status:** Zaakceptowany  
**Data:** 2026-05-05

## Kontekst

Platforma korepetycji potrzebuje mechanizmu płatności: uczeń płaci za sesję, korepetytor otrzymuje wynagrodzenie pomniejszone o prowizję platformy.

Pełna integracja płatności (Stripe + Stripe Connect) to znaczący zakres prac:
- Stripe Payment Intents dla uczniów (doładowanie salda)
- Stripe Connect Express dla korepetytorów (onboarding, weryfikacja tożsamości)
- Webhooki do obsługi asynchronicznych zdarzeń płatniczych
- Obsługa zwrotów, sporów, błędów sieciowych

Stripe Connect wymaga ponadto przejścia procesu weryfikacji przez Stripe, który może trwać kilka tygodni dla nowej firmy.

## Decyzja

W MVP **nie integrujemy żadnej bramki płatności**. System ewidencjonuje kwoty w bazie danych, a rzeczywisty przepływ pieniędzy odbywa się ręcznie poza aplikacją.

Konkretnie:
- Po zakończeniu sesji system oblicza i zapisuje: koszt sesji, należność korepetytora, prowizję platformy
- Administrator platformy obsługuje wypłaty ręcznie (przelew bankowy)
- Uczniowie rozliczają się z platformą poza aplikacją (np. BLIK, przelew)

## Uzasadnienie

Celem MVP jest walidacja hipotezy biznesowej: *czy uczniowie będą korzystać z korepetycji on-demand i czy korepetytorzy będą chcieli być dostępni na platformie?*

Odpowiedź na to pytanie nie wymaga automatycznych płatności. Wymaga działającego mechanizmu kojarzenia i sesji wideo. Inwestycja w integrację płatności przed walidacją hipotezy to przedwczesna optymalizacja.

Dodatkowo: na małej skali (pierwsze dziesiątki sesji) ręczne rozliczenia są całkowicie zarządzalne.

## Konsekwencje

**Pozytywne:**
- Tygodnie zaoszczędzonego czasu developmentu
- Brak kosztów i zależności od Stripe na etapie MVP
- Możliwość startu bez przechodzenia procesu weryfikacji Stripe Connect
- Mniejsza powierzchnia ataku bezpieczeństwa (brak wrażliwych danych płatniczych)

**Negatywne / ryzyka:**
- Ręczne rozliczenia nie skalują się — to świadomy dług techniczny
- Brak automatyzacji może być barierą przy onboardingu korepetytorów ("kiedy dostanę pieniądze?")
- Wymaga zaufania między platformą a użytkownikami

**Ścieżka do pełnej integracji (post-MVP):**

Schemat bazy jest zaprojektowany z myślą o tej rozbudowie. Tabela `tutor_earnings` ma kolumnę `paid_out_at` (null = nie wypłacono), która w przyszłości zostanie zastąpiona przez automatyczne transfery Stripe Connect. Dodanie Stripe będzie wymagało:

1. Dodania `stripe_customer_id` do tabeli `users`
2. Dodania `stripe_account_id` do `tutor_profiles`
3. Implementacji Stripe Payment Intents (saldo prepaid ucznia)
4. Implementacji Stripe Connect (automatyczne wypłaty)
5. Endpointu webhookowego dla zdarzeń Stripe

Logika obliczania kwot i prowizji pozostaje bez zmian.