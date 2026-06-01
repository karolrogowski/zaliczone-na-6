-- ============================================================
-- Optymalizacja: pomiń reagregację gdy zmieniła się tylko preference
-- ============================================================
-- refresh_tutor_rating_trg odpala się przy każdym UPDATE na ratings,
-- w tym przy removeFavoriteTutor / removeAvoidPreference (UPDATE SET preference=null).
-- Zmiana preference nie wpływa na bayesian_score — pełna reagregacja jest zbędna.
--
-- Guard: jeśli żadna z kolumn numerycznych się nie zmieniła, wyjdź wcześnie.

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
  k        constant numeric := 5;
  mu       constant numeric := 4.3;
begin
  if new.rated_by <> 'student' then
    return new;
  end if;

  -- Pomiń reagregację gdy żadna kolumna numeryczna się nie zmieniła
  -- (np. UPDATE SET preference=null przy removeFavoriteTutor).
  if TG_OP = 'UPDATE'
     and new.score_knowledge    is not distinct from old.score_knowledge
     and new.score_organization is not distinct from old.score_organization
     and new.score_communication is not distinct from old.score_communication
     and new.admin_weight       is not distinct from old.admin_weight then
    return new;
  end if;

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
