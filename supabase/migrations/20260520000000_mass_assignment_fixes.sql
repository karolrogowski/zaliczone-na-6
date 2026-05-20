-- [Vuln 2/3] Ochrona przed mass assignment na profiles.role oraz tutor_profiles
-- (rating_avg, rating_count, stripe_account_id).
--
-- Problem: polityki "profiles_own" i "tutor_profiles_own" były zdefiniowane jako
-- "for all using (auth.uid() = id)" bez "with check" i bez ograniczeń kolumnowych.
-- Zalogowany użytkownik mógł z konsoli wykonać UPDATE i zmienić własną rolę na
-- 'admin' lub zawyżyć swoją ocenę w katalogu publicznym.
--
-- Defense-in-depth:
--   1. Podział "for all" na SELECT + UPDATE z "with check" trzymającym właściciela.
--   2. Column-level GRANT: odbieramy table-level UPDATE i przyznajemy tylko na
--      kolumnach, które użytkownik faktycznie powinien móc zmieniać. Tabela-wide
--      GRANT nadpisałby column-level REVOKE, więc musimy najpierw zdjąć całość.
--   3. Trigger refresh_tutor_rating ustawiony jako SECURITY DEFINER, żeby mógł
--      aktualizować rating_avg/rating_count mimo zawężonych uprawnień.
--   4. Triggery updated_at działają mimo zawężonych uprawnień, bo modyfikacja
--      NEW.updated_at odbywa się w kontekście funkcji triggera, a nie wprost
--      w klauzuli SET zapytania użytkownika.

-- ============================================================
-- profiles
-- ============================================================
drop policy if exists "profiles_own" on public.profiles;

create policy "profiles_own_select" on public.profiles
  for select to authenticated
  using (auth.uid() = id);

create policy "profiles_own_update" on public.profiles
  for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- INSERT i DELETE celowo bez polityki — INSERT robi trigger handle_new_user
-- (security definer), DELETE odbywa się kaskadowo z auth.users.

revoke update on public.profiles from authenticated;
grant update (full_name, avatar_url, phone) on public.profiles to authenticated;

-- ============================================================
-- tutor_profiles
-- ============================================================
drop policy if exists "tutor_profiles_own" on public.tutor_profiles;

create policy "tutor_profiles_own_update" on public.tutor_profiles
  for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "tutor_profiles_own_insert" on public.tutor_profiles
  for insert to authenticated
  with check (auth.uid() = id);

revoke update on public.tutor_profiles from authenticated;
grant update (hourly_rate_grosz, bio, is_available, levels)
  on public.tutor_profiles to authenticated;

-- ============================================================
-- refresh_tutor_rating: SECURITY DEFINER
-- ============================================================
-- Po zawężeniu uprawnień do kolumn, trigger uruchamiany w kontekście zalogowanego
-- ucznia (po INSERT na ratings) nie mógłby aktualizować rating_avg/rating_count.
-- Zmieniamy funkcję na SECURITY DEFINER z explicit search_path, żeby
-- denormalizacja oceny działała niezależnie od uprawnień wywołującego.
create or replace function public.refresh_tutor_rating()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.tutor_profiles
  set
    rating_count = sub.cnt,
    rating_avg   = sub.avg_score
  from (
    select
      count(*)::integer             as cnt,
      round(avg(score)::numeric, 2) as avg_score
    from public.ratings
    where tutor_id = new.tutor_id
  ) sub
  where id = new.tutor_id;
  return new;
end;
$$;