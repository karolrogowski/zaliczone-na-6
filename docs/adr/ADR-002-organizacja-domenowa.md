# ADR-002: Organizacja kodu według domen, nie warstw technicznych

**Status:** Zaakceptowany  
**Data:** 2026-05-05

## Kontekst

W monolicie (ADR-001) kluczowa jest wewnętrzna organizacja kodu. Istnieją dwa popularne podejścia:

**Organizacja warstwowa** (klasyczna):
```
src/
  components/   ← wszystkie komponenty UI
  lib/          ← wszystkie helpery
  api/          ← wszystkie endpointy
```

**Organizacja domenowa**:
```
src/
  domains/
    matching/   ← wszystko związane z kojarzeniem
    payments/   ← wszystko związane z ewidencją finansową
    sessions/   ← wszystko związane z sesjami wideo
    auth/       ← wszystko związane z autentykacją
    ratings/    ← wszystko związane z ocenami
```

## Decyzja

Stosujemy **organizację domenową**. Każda domena zawiera własne: typy TypeScript, logikę biznesową, hooki React, komponenty UI i akcje serwerowe.

Warstwa routingu (`src/app/`) jest cienka — tylko importuje z domen, nie zawiera logiki.

## Uzasadnienie

Organizacja warstwowa powoduje, że kod jednej funkcjonalności jest rozproszony po wielu katalogach. Żeby zrozumieć "jak działa kojarzenie", trzeba czytać pliki z `components/`, `lib/` i `api/` jednocześnie.

Organizacja domenowa trzyma powiązany kod razem. Żeby zrozumieć kojarzenie, czytasz tylko `domains/matching/`.

Kluczowa korzyść dla przyszłości: jeśli za rok chcemy wydzielić płatności jako osobny serwis, cały kod jest już zgrupowany w `domains/payments/`. Nie ma rozległego refaktoryzowania — jest przepakowanie.

## Struktura domeny

Każda domena ma przewidywalną strukturę wewnętrzną:

```
domains/matching/
  types.ts          ← typy TypeScript dla tej domeny
  actions.ts        ← Server Actions (mutacje)
  queries.ts        ← funkcje pobierające dane
  hooks/            ← React hooks (logika po stronie klienta)
  components/       ← komponenty UI specyficzne dla tej domeny
```

## Konsekwencje

**Pozytywne:**
- Łatwe nawigowanie — "gdzie jest kod do kojarzenia?" → `domains/matching/`
- Naturalna granica przy przyszłym wydzielaniu serwisów
- Każda domena może być rozwijana niezależnie

**Negatywne / ryzyka:**
- Wymaga dyscypliny: komponenty i logika nie mogą "wyciekać" między domenami
- Współdzielone elementy (np. ogólny przycisk UI) muszą trafiać do `shared/`, nie do domeny — to wymaga świadomej decyzji przy każdym nowym pliku

**Zasada:** jeśli coś jest używane przez więcej niż jedną domenę → trafia do `src/shared/`. Jeśli tylko przez jedną → zostaje w tej domenie.