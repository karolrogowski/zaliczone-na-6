-- Wydłużenie okna na dopasowanie korepetytora z 5 do 10 minut.
--
-- expires_at jest ustawiane przy tworzeniu zlecenia, czyli ZANIM uczeń
-- wypełni formularz płatności Stripe — w praktyce 5-minutowe okno zostawiało
-- realnie ok. 1 minutę na znalezienie korepetytora po dokończeniu płatności.

create or replace function public.matching_requests_normalize_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Service role może wstawiać dowolne wartości (testy, seed, migracje)
  if auth.uid() is null then
    return new;
  end if;

  -- Wymuszamy domyślne wartości niezależnie od tego, co przysłał klient
  new.expires_at := now() + interval '10 minutes';
  new.tutor_id := null;
  new.status := 'pending';
  new.created_at := now();
  new.updated_at := now();
  new.student_id := auth.uid();

  return new;
end;
$$;

alter table public.matching_requests
  alter column expires_at set default (now() + interval '10 minutes');
