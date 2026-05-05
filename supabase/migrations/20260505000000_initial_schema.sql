-- ============================================================
-- Helper: auto-update updated_at
-- ============================================================
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================
-- Lookup tables
-- ============================================================
create table subjects (
  id        text primary key,
  label     text not null,
  is_active boolean not null default true
);

create table platform_config (
  key         text primary key,
  value       text not null,
  description text
);

-- ============================================================
-- User profiles (extends auth.users)
-- ============================================================
create table profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  role       text not null check (role in ('student', 'tutor')),
  full_name  text not null,
  avatar_url text,
  phone      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_updated_at
  before update on profiles
  for each row execute function update_updated_at();

-- ============================================================
-- Tutor-specific data
-- ============================================================
create table tutor_profiles (
  id                uuid primary key references profiles(id) on delete cascade,
  hourly_rate_grosz integer not null check (hourly_rate_grosz > 0),
  bio               text,
  is_available      boolean not null default false,
  rating_avg        numeric(3, 2),
  rating_count      integer not null default 0,
  stripe_account_id text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create trigger tutor_profiles_updated_at
  before update on tutor_profiles
  for each row execute function update_updated_at();

-- Przedmioty nauczane przez korepetytora (many-to-many)
create table tutor_subjects (
  tutor_id   uuid references tutor_profiles(id) on delete cascade,
  subject_id text references subjects(id) on delete restrict,
  primary key (tutor_id, subject_id)
);

-- ============================================================
-- Matching
-- ============================================================
create table matching_requests (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references profiles(id),
  tutor_id    uuid references profiles(id),
  subject_id  text not null references subjects(id),
  description text,
  status      text not null default 'pending'
              check (status in ('pending', 'accepted', 'cancelled', 'expired')),
  expires_at  timestamptz not null default (now() + interval '5 minutes'),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger matching_requests_updated_at
  before update on matching_requests
  for each row execute function update_updated_at();

-- Indeksy dla częstych zapytań matching engine
create index matching_requests_student_id_idx    on matching_requests(student_id);
create index matching_requests_status_subject_idx on matching_requests(status, subject_id);

-- ============================================================
-- Sessions
-- ============================================================
create table sessions (
  id                  uuid primary key default gen_random_uuid(),
  matching_request_id uuid not null unique references matching_requests(id),
  student_id          uuid not null references profiles(id),
  tutor_id            uuid not null references profiles(id),
  daily_room_name     text not null,
  daily_room_url      text not null,
  status              text not null default 'scheduled'
                      check (status in ('scheduled', 'in_progress', 'completed', 'cancelled')),
  started_at          timestamptz,
  ended_at            timestamptz,
  duration_minutes    integer,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create trigger sessions_updated_at
  before update on sessions
  for each row execute function update_updated_at();

create index sessions_student_id_idx on sessions(student_id);
create index sessions_tutor_id_idx   on sessions(tutor_id);

-- ============================================================
-- Ewidencja finansowa (bez realnych płatności w MVP — ADR-004)
-- ============================================================
create table session_financials (
  id                        uuid primary key default gen_random_uuid(),
  session_id                uuid not null unique references sessions(id),
  student_cost_grosz        integer not null check (student_cost_grosz >= 0),
  tutor_earning_grosz       integer not null check (tutor_earning_grosz >= 0),
  platform_commission_grosz integer not null check (platform_commission_grosz >= 0),
  paid_out_at               timestamptz,
  created_at                timestamptz not null default now()
);

-- ============================================================
-- Ratings
-- ============================================================
create table ratings (
  id         uuid primary key default gen_random_uuid(),
  session_id uuid not null unique references sessions(id),
  student_id uuid not null references profiles(id),
  tutor_id   uuid not null references profiles(id),
  score      smallint not null check (score between 1 and 5),
  comment    text,
  created_at timestamptz not null default now()
);

-- Trigger: utrzymuje denormalizowane rating_avg i rating_count na tutor_profiles
create or replace function refresh_tutor_rating()
returns trigger language plpgsql as $$
begin
  update tutor_profiles
  set
    rating_count = sub.cnt,
    rating_avg   = sub.avg_score
  from (
    select
      count(*)::integer           as cnt,
      round(avg(score)::numeric, 2) as avg_score
    from ratings
    where tutor_id = new.tutor_id
  ) sub
  where id = new.tutor_id;
  return new;
end;
$$;

create trigger ratings_after_insert
  after insert on ratings
  for each row execute function refresh_tutor_rating();

-- ============================================================
-- Row Level Security
-- ============================================================
alter table subjects           enable row level security;
alter table platform_config    enable row level security;
alter table profiles           enable row level security;
alter table tutor_profiles     enable row level security;
alter table tutor_subjects     enable row level security;
alter table matching_requests  enable row level security;
alter table sessions           enable row level security;
alter table session_financials enable row level security;
alter table ratings            enable row level security;

-- subjects: każdy (w tym niezalogowani) widzi aktywne przedmioty
create policy "subjects_read" on subjects
  for select using (is_active = true);

-- platform_config: tylko zalogowani mogą czytać
create policy "platform_config_read" on platform_config
  for select to authenticated using (true);

-- profiles: własny profil (pełny dostęp) + profile korepetytorów (tylko odczyt)
create policy "profiles_own" on profiles
  for all using (auth.uid() = id);

create policy "profiles_read_tutors" on profiles
  for select to authenticated using (role = 'tutor');

-- tutor_profiles: każdy zalogowany widzi; właściciel edytuje
create policy "tutor_profiles_read" on tutor_profiles
  for select to authenticated using (true);

create policy "tutor_profiles_own" on tutor_profiles
  for all using (auth.uid() = id);

-- tutor_subjects: każdy zalogowany widzi; korepetytor zarządza swoimi
create policy "tutor_subjects_read" on tutor_subjects
  for select to authenticated using (true);

create policy "tutor_subjects_own" on tutor_subjects
  for all using (auth.uid() = tutor_id);

-- matching_requests:
--   uczeń — pełny dostęp do swoich zgłoszeń
--   korepetytor — widzi pending z jego przedmiotów (gdy is_available=true)
--   korepetytor — może zaakceptować pending (ustawić tutor_id i status)
create policy "matching_requests_student_own" on matching_requests
  for all using (auth.uid() = student_id);

create policy "matching_requests_tutor_read_pending" on matching_requests
  for select to authenticated
  using (
    status = 'pending'
    and exists (
      select 1 from tutor_subjects ts
      join tutor_profiles tp on tp.id = ts.tutor_id
      where ts.tutor_id   = auth.uid()
        and ts.subject_id = matching_requests.subject_id
        and tp.is_available = true
    )
  );

create policy "matching_requests_tutor_accept" on matching_requests
  for update to authenticated
  using (
    status    = 'pending'
    and tutor_id is null
    and exists (
      select 1 from tutor_subjects ts
      where ts.tutor_id   = auth.uid()
        and ts.subject_id = matching_requests.subject_id
    )
  )
  with check (
    tutor_id = auth.uid()
    and status = 'accepted'
  );

-- sessions: uczestnik sesji (uczeń lub korepetytor) może czytać
create policy "sessions_participant" on sessions
  for select to authenticated
  using (auth.uid() = student_id or auth.uid() = tutor_id);

-- session_financials: uczeń widzi swój koszt; korepetytor widzi swój zarobek
create policy "session_financials_student" on session_financials
  for select to authenticated
  using (
    exists (
      select 1 from sessions s
      where s.id = session_financials.session_id
        and s.student_id = auth.uid()
    )
  );

create policy "session_financials_tutor" on session_financials
  for select to authenticated
  using (
    exists (
      select 1 from sessions s
      where s.id = session_financials.session_id
        and s.tutor_id = auth.uid()
    )
  );

-- ratings: uczeń wystawia ocenę po ukończonej sesji; wszyscy zalogowani czytają
create policy "ratings_student_insert" on ratings
  for insert to authenticated
  with check (
    auth.uid() = student_id
    and exists (
      select 1 from sessions s
      where s.id         = session_id
        and s.student_id = auth.uid()
        and s.status     = 'completed'
    )
  );

create policy "ratings_read" on ratings
  for select to authenticated using (true);

-- ============================================================
-- Dane seedowe
-- ============================================================
insert into subjects (id, label) values
  ('matematyka',      'Matematyka'),
  ('fizyka',          'Fizyka'),
  ('chemia',          'Chemia'),
  ('biologia',        'Biologia'),
  ('jezyk_polski',    'Język polski'),
  ('jezyk_angielski', 'Język angielski'),
  ('jezyk_niemiecki', 'Język niemiecki'),
  ('historia',        'Historia'),
  ('informatyka',     'Informatyka'),
  ('geografia',       'Geografia');

insert into platform_config (key, value, description) values
  ('commission_pct', '20', 'Prowizja platformy w procentach (0–100)');
