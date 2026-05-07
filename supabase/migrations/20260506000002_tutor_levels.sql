-- Poziomy nauczania korepetytora (tablica kodów, np. ['liceum_1', 'matura'])
alter table tutor_profiles add column levels text[] not null default '{}';
