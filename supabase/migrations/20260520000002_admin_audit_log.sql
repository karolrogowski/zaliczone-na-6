-- [Vuln 7.6] Audit log dla akcji panelu administracyjnego.
--
-- Problem: actions z domeny admin (markSessionPaid, updateCommissionPct,
-- toggleSubjectActive, adminLogin) wykonują operacje przez service role
-- omijający RLS i nie zostawiają żadnego śladu. W razie sporu lub incydentu
-- nie da się odtworzyć kto i kiedy wykonał czynność.
--
-- Tabela admin_audit_log jest append-only:
--   - INSERT — wyłącznie przez service role (admin actions),
--   - SELECT — admin może czytać własne wpisy oraz wpisy innych adminów
--     (audyt wzajemny). Studenci/korepetytorzy: brak dostępu.
--   - UPDATE/DELETE — całkowicie zablokowane przez brak polityk.

create table public.admin_audit_log (
  id          uuid primary key default gen_random_uuid(),
  admin_id    uuid not null references public.profiles(id),
  action      text not null,
  target_type text,
  target_id   text,
  payload     jsonb not null default '{}'::jsonb,
  ip_address  text,
  created_at  timestamptz not null default now()
);

create index admin_audit_log_admin_id_idx   on public.admin_audit_log(admin_id);
create index admin_audit_log_action_idx     on public.admin_audit_log(action);
create index admin_audit_log_created_at_idx on public.admin_audit_log(created_at desc);

alter table public.admin_audit_log enable row level security;

-- Tylko admin może odczytywać log (przez klienta SSR, czyli z RLS aktywnym).
-- INSERT/UPDATE/DELETE brak polityki — operacje wyłącznie przez service role.
create policy "admin_audit_log_read" on public.admin_audit_log
  for select to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );