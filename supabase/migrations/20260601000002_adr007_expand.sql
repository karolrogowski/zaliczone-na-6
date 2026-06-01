-- ============================================================
-- ADR-007 PR 1/3 — Expand: nowe kolumny obok starych
-- ============================================================
-- Stare kolumny (score, rating_avg, rating_count) pozostają
-- nienaruszone. Kod produkcyjny ich nadal używa. Nowe kolumny
-- są nullable — istniejące wiersze automatycznie mają NULL.
-- Backfill w następnej migracji (20260601000003).

-- ── ratings ──────────────────────────────────────────────────

alter table public.ratings
  add column score_knowledge    smallint
    check (score_knowledge    between 1 and 5),
  add column score_organization smallint
    check (score_organization between 1 and 5),
  add column score_communication smallint
    check (score_communication between 1 and 5),
  add column justification_category text
    check (justification_category in (
      'late_or_cancelled',
      'unprepared',
      'low_quality',
      'communication',
      'misconduct',
      'other'
    )),
  add column editable_until     timestamptz,
  add column admin_weight       numeric(3,1) not null default 1.0
    check (admin_weight in (0, 0.5, 1.0)),
  add column admin_note         text,
  add column payment_confirmed  boolean not null default true;

-- ── tutor_profiles ───────────────────────────────────────────

alter table public.tutor_profiles
  add column bayesian_score numeric(4,3);
