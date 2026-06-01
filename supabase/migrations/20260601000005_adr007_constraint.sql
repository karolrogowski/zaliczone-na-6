-- ============================================================
-- ADR-007 PR 2/3 — Constraint spójności po aktualizacji kodu
-- ============================================================
-- Kod aplikacji zapisuje już score_knowledge/organization/communication
-- dla każdej nowej oceny ucznia. Można teraz wymusić NOT NULL.

alter table public.ratings
  add constraint ratings_student_scores_complete
  check (
    rated_by = 'tutor'
    or (
      score_knowledge     is not null
      and score_organization  is not null
      and score_communication is not null
    )
  );
