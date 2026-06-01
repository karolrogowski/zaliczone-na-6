-- ============================================================
-- ADR-007 PR 1/3 — Backfill: wypełnienie nowych kolumn
-- ============================================================

-- 1. Backfill 3 wymiarów dla istniejących ocen uczniów.
--    Zakładamy że poprzednie oceny są "jednorodne" — brak danych
--    żeby rozróżnić wymiary, więc wszystkie trzy = stara wartość score.
update public.ratings
set
  score_knowledge     = score,
  score_organization  = score,
  score_communication = score,
  editable_until      = created_at + interval '15 minutes'
where rated_by = 'student'
  and score    is not null;

-- 2. Backfill bayesian_score w tutor_profiles.
--    Wzór: S_bayes = (Σ S_i × w_i + k × μ) / (Σ w_i + k)
--    Tutaj wszystkie wagi w_i = 1 (admin_weight=1, brak decay/student_weight w MVP),
--    μ = 4.3 (globalna średnia startera), k = 5 (siła priora).
update public.tutor_profiles tp
set bayesian_score = sub.bayes
from (
  select
    tutor_id,
    round(
      (sum(score) + 5 * 4.3) / (count(*) + 5)
    , 3) as bayes
  from public.ratings
  where rated_by = 'student'
    and score    is not null
  group by tutor_id
) sub
where tp.id = sub.tutor_id;

-- Constraint spójności (ratings_student_scores_complete) przeniesiony
-- do migracji PR 2, po tym jak kod aplikacji zacznie zapisywać 3 wymiary.
-- W PR 1 kolumny są nullable — istniejące inserty z samym score nadal działają.
