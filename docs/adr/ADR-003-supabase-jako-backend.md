# ADR-003: Supabase jako główna warstwa backendowa

**Status:** Zaakceptowany  
**Data:** 2026-05-05

## Kontekst

Aplikacja potrzebuje: bazy danych relacyjnej, systemu autentykacji, mechanizmu powiadomień w czasie rzeczywistym (kluczowego dla kojarzenia ucznia z korepetytorem) oraz prostego panelu do zarządzania danymi podczas developmentu.

Alternatywy:
- Własna baza PostgreSQL + własne auth + własny WebSocket server
- Firebase (Firestore + Firebase Auth)
- PlanetScale + NextAuth + Pusher

## Decyzja

Używamy **Supabase** jako głównej warstwy infrastruktury: baza danych (PostgreSQL), autentykacja (Supabase Auth), powiadomienia real-time (Supabase Realtime) i panel admina (Supabase Studio).

## Uzasadnienie

Supabase zastępuje kilka osobnych usług jedną platformą z darmowym planem wystarczającym na MVP:

| Potrzeba | Bez Supabase | Z Supabase |
|---|---|---|
| Baza danych | Hostowany PostgreSQL (~20 USD/mies.) | Wbudowane — bezpłatnie |
| Autentykacja | NextAuth + konfiguracja providerów | Wbudowane — bezpłatnie |
| Real-time | Pusher lub własny WebSocket | Wbudowane — bezpłatnie |
| Panel do bazy | Własny lub pgAdmin | Supabase Studio — bezpłatnie |

Supabase Realtime jest szczególnie krytyczny: mechanizm kojarzenia (ADR-001 analogia do dispatcha Uber) wymaga push notifications do korepetytorów gdy pojawia się nowe zlecenie. Implementacja własnego WebSocket servera to tygodnie pracy, Supabase Realtime to kilka linii kodu.

Ryzyko uzależnienia od dostawcy (vendor lock-in) jest świadomie akceptowane na etapie MVP. Jeśli projekt urośnie, migracja jest możliwa — Supabase to PostgreSQL pod spodem, więc dane są przenośne.

## Konsekwencje

**Pozytywne:**
- Zero kosztu infrastruktury na MVP
- Autentykacja gotowa od razu (email/hasło, potencjalnie OAuth w przyszłości)
- Real-time bez własnego serwera WebSocket
- Row Level Security (RLS) = bezpieczeństwo na poziomie bazy, nie tylko aplikacji

**Negatywne / ryzyka:**
- Vendor lock-in: RLS i Supabase Realtime są specyficzne dla Supabase
- Darmowy plan ma limity (500 MB bazy, 2 GB transferu/mies., 50 000 MAU) — wystarczające dla MVP, ale wymagają monitorowania przy wzroście
- Lokalny development wymaga Dockera (Supabase CLI uruchamia lokalną instancję)

**Mitygacja vendor lock-in:**
Logika biznesowa jest w czystych funkcjach TypeScript, nie spleciona z API Supabase. Warstwa dostępu do danych (`queries.ts`, `actions.ts` w każdej domenie) izoluje resztę aplikacji od szczegółów Supabase.