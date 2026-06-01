-- ============================================================
-- ADR-007 PR 3/3 — Contract: usunięcie starych kolumn
-- ============================================================
-- Kod aplikacji używa wyłącznie score_knowledge/organization/communication.
-- Kolumna score nie jest już czytana ani zapisywana przez żaden kod.
-- Warunek bezpieczeństwa: uruchom grep -r '"score"' src/ przed deployem —
-- musi zwrócić zero trafień.

alter table public.ratings drop column score;
