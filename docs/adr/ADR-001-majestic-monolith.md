# ADR-001: Majestic Monolith zamiast mikroserwisów

**Status:** Zaakceptowany  
**Data:** 2026-05-05

## Kontekst

Platforma "Zaliczone na 6" wymaga kilku odrębnych obszarów funkcjonalnych: kojarzenia uczniów z korepetytorami, sesji wideo, ewidencji finansowej i autentykacji. Przy projektowaniu systemu pojawia się naturalne pytanie: czy rozdzielić te obszary na osobne mikroserwisy, czy trzymać wszystko razem?

Projekt jest budowany przez jedną osobę wspieraną przez AI, bez dedykowanego zespołu DevOps. To jest MVP, którego głównym celem jest walidacja pomysłu biznesowego, nie obsługa dużego ruchu.

## Decyzja

Budujemy **jedną aplikację Next.js** (Majestic Monolith) wdrożoną jako jeden serwis na Vercel.

Nie używamy mikroserwisów, osobnych API, message brokerów ani żadnej rozproszonej infrastruktury.

## Uzasadnienie

Mikroserwisy rozwiązują problemy, których na tym etapie jeszcze nie mamy:
- **Niezależne skalowanie** — nie wiemy jeszcze, które części systemu będą wąskim gardłem
- **Niezależne wdrożenia** — przy jednej osobie to overhead, nie korzyść
- **Izolacja awarii** — z jednym deweloperem trudniej zarządzać siecią serwisów niż jednym procesem

Majestic Monolith na tym etapie oznacza:
- Jeden deploy zamiast wielu
- Zero zarządzania siecią między serwisami
- Zero latencji między "serwisami" — to zwykłe wywołania funkcji
- Pełny stack w jednym repozytorium — łatwiejsze utrzymanie

## Konsekwencje

**Pozytywne:**
- Drastycznie uproszczone wdrożenie (jeden `git push` → jeden deployment)
- Brak kosztów infrastruktury między serwisami
- Łatwiejsze debugowanie — jeden log, jeden proces

**Negatywne / ryzyka:**
- Przy dużym wzroście ruchu skalowanie odbywa się jako całość, nie per-moduł
- Ryzyko, że moduły zaczną się przenikać, jeśli nie zachowamy dyscypliny architektonicznej (mitygowane przez ADR-002)

**Ścieżka wyjścia:**
Jeśli projekt urośnie do skali wymagającej mikroserwisów, organizacja domenowa kodu (ADR-002) sprawia, że wydzielenie modułu jest przepakowaniem istniejącego kodu, a nie jego przepisaniem.