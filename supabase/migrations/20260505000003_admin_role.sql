-- Dodaj rolę admin do tabeli profiles
alter table profiles drop constraint profiles_role_check;
alter table profiles add constraint profiles_role_check
  check (role in ('student', 'tutor', 'admin'));

-- Helper function używany przez Server Actions do weryfikacji roli admina
create or replace function is_admin()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'admin'
  )
$$;
