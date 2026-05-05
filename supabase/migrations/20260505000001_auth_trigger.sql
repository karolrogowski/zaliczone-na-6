-- hourly_rate_grosz jest null przy pierwszej rejestracji korepetytora
-- (uzupełniany w kroku konfiguracji profilu po rejestracji)
alter table tutor_profiles alter column hourly_rate_grosz drop not null;
alter table tutor_profiles drop constraint tutor_profiles_hourly_rate_grosz_check;
alter table tutor_profiles add constraint tutor_profiles_hourly_rate_grosz_check
  check (hourly_rate_grosz is null or hourly_rate_grosz > 0);

-- Trigger: automatycznie tworzy profil po rejestracji w Supabase Auth
-- Dane roli i imienia są przekazywane przez options.data w signUp()
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  v_role text;
  v_full_name text;
begin
  v_role      := new.raw_user_meta_data ->> 'role';
  v_full_name := new.raw_user_meta_data ->> 'full_name';

  insert into public.profiles (id, role, full_name)
  values (new.id, v_role, coalesce(v_full_name, ''));

  if v_role = 'tutor' then
    insert into public.tutor_profiles (id)
    values (new.id);
  end if;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
