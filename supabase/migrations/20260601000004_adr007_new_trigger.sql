-- ============================================================
-- ADR-007 PR 1/3 — Nowy trigger: Bayesowska średnia ważona
-- ============================================================
-- Zastępuje refresh_tutor_rating() (CREATE OR REPLACE).
-- Czyta score_knowledge/organization/communication; oblicza
-- rating_avg (admin panel) i bayesian_score (ranking MVP).
--
-- Trigger anomalii (flag_suspicious_rating) jest AFTER_MVP —
-- stary był usunięty w 20260601000001 i nie jest tu odtwarzany.

create or replace function public.refresh_tutor_rating()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count  integer;
  v_avg    numeric;
  v_bayes  numeric;
  k        constant numeric := 5;    -- siła priora Bayesowskiego
  mu       constant numeric := 4.3;  -- globalna średnia startera
begin
  if new.rated_by <> 'student' then
    return new;
  end if;

  -- Agreguj po średniej z 3 wymiarów każdej oceny.
  select
    count(*)::integer,
    round(
      avg((score_knowledge + score_organization + score_communication) / 3.0)
    , 2)
  into v_count, v_avg
  from public.ratings
  where tutor_id = new.tutor_id
    and rated_by = 'student'
    and score_knowledge    is not null
    and score_organization is not null
    and score_communication is not null;

  -- Bayesowska średnia: (n × avg + k × μ) / (n + k)
  -- MVP: wagi = 1 dla każdej oceny (brak decay, brak student_weight).
  if v_count > 0 then
    v_bayes := round(
      (v_avg * v_count + k * mu) / (v_count + k)
    , 3);
  else
    v_bayes := null;
  end if;

  update public.tutor_profiles
  set
    rating_count   = v_count,
    rating_avg     = v_avg,
    bayesian_score = v_bayes
  where id = new.tutor_id;

  return new;
end;
$$;

-- Trigger odpala się też przy UPDATE — potrzebne dla okna edycji 15 min.
drop trigger if exists refresh_tutor_rating_trg on public.ratings;
create trigger refresh_tutor_rating_trg
  after insert or update on public.ratings
  for each row execute function public.refresh_tutor_rating();
