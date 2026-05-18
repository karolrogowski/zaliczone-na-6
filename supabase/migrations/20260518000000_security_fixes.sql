-- [Vuln 1] Whitelist ról w triggerze handle_new_user.
-- Konta admina muszą być tworzone wyłącznie przez service role (migracja/seed),
-- nie przez publiczne API rejestracji.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  v_role text;
  v_full_name text;
begin
  v_role := case when new.raw_user_meta_data ->> 'role' in ('student', 'tutor')
                 then new.raw_user_meta_data ->> 'role'
                 else 'student' end;
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

-- [I1] Dodaj set search_path = '' do is_admin() — obrona przed schema injection.
create or replace function is_admin()
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  )
$$;

-- [I3] Ogranicz widoczność profili uczniów do aktywnych/zakończonych zleceń.
drop policy if exists "profiles_read_students_in_sessions" on public.profiles;
create policy "profiles_read_students_in_sessions" on public.profiles
  for select to authenticated
  using (
    role = 'student'
    and exists (
      select 1 from public.matching_requests mr
      where mr.student_id = public.profiles.id
        and mr.tutor_id = auth.uid()
        and mr.status in ('accepted', 'completed')
    )
  );
