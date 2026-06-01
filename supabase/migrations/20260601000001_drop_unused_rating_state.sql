-- ============================================================
-- Usunięcie martwego stanu: wilson_score i flagged_for_review
-- ============================================================
-- wilson_score: obliczany przez trigger refresh_tutor_rating,
-- ale nigdy nierczytany przez żaden kod aplikacji ani panel admina.
--
-- flagged_for_review: ustawiany przez trigger flag_suspicious_rating,
-- ale żadne zapytanie w kodzie aplikacji tego nie czyta.
--
-- Oba istniały jako placeholdery dla funkcji AFTER_MVP.
-- ADR-007 zastąpi je bayesian_score i admin_weight — czystsze jest
-- usunięcie martwego stanu przed tą migracją niż jego współistnienie.

-- 1. Usuń trigger i funkcję detekcji anomalii (flaga szła do nieczytelnej kolumny)
drop trigger if exists ratings_flag_suspicious_trg on public.ratings;
drop function if exists public.flag_suspicious_rating();

-- 2. Usuń kolumnę flagged_for_review z ratings
alter table public.ratings drop column if exists flagged_for_review;

-- 3. Zastąp refresh_tutor_rating — usuń obliczanie wilson_score
create or replace function public.refresh_tutor_rating()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
  v_avg   numeric;
begin
  if new.rated_by <> 'student' then
    return new;
  end if;

  select
    count(*)::integer,
    round(avg(score)::numeric, 2)
  into v_count, v_avg
  from public.ratings
  where tutor_id = new.tutor_id
    and rated_by = 'student';

  update public.tutor_profiles
  set
    rating_count = v_count,
    rating_avg   = v_avg
  where id = new.tutor_id;

  return new;
end;
$$;

-- 4. Usuń kolumnę wilson_score z tutor_profiles
alter table public.tutor_profiles drop column if exists wilson_score;
