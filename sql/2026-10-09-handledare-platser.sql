-- LIAlink: handledare som post, och LIA-behov som egna platser
-- 2026-10-09
--
-- Bakgrund: behovet (looking_for, sector, city, period, spots) låg på
-- companies-raden, så ett företag kunde bara uttrycka ett behov. Ett företag
-- med PLC, elektriker och fiber behöver tre. Och handledaren fanns bara som
-- fritext i agreements, så hon kunde inte räknas eller kopplas till placeringen.
--
-- Inget raderas här. Kolumnerna på companies ligger kvar tills matchningen
-- gått över till lia_platser.

begin;

-- ---------------------------------------------------------------
-- 1. Handledare: en person hos ett företag. Konto är frivilligt.
-- ---------------------------------------------------------------

create table if not exists handledare (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references companies(id) on delete cascade,
  name        text not null,
  email       text,
  phone       text,
  roll        text,
  -- Sätts om och när hon skapar ett konto. En handledare utan konto
  -- räknas och syns ändå.
  user_id     uuid references profiles(id) on delete set null,
  aktiv       boolean not null default true,
  note        text,
  created_at  timestamptz not null default now()
);

create unique index if not exists handledare_foretag_epost
  on handledare (company_id, lower(email))
  where email is not null;

create index if not exists handledare_company_idx on handledare (company_id);
create index if not exists handledare_user_idx    on handledare (user_id);

-- ---------------------------------------------------------------
-- 2. LIA-platser: ett behov per rad, ägt av en handledare
-- ---------------------------------------------------------------

create table if not exists lia_platser (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references companies(id) on delete cascade,
  handledare_id uuid references handledare(id) on delete set null,
  titel         text not null,
  beskrivning   text,
  kompetenser   text[] not null default '{}',
  bransch       text,
  ort           text,
  period_start  date,
  period_end    date,
  antal         integer not null default 1,
  antal_lediga  integer not null default 1,
  open_to       text not null default 'alla',
  status        text not null default 'oppen',
  created_by    uuid references profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint lia_platser_status_chk  check (status  in ('oppen', 'pausad', 'fylld')),
  constraint lia_platser_open_to_chk check (open_to in ('alla', 'valda'))
);

create index if not exists lia_platser_company_idx    on lia_platser (company_id);
create index if not exists lia_platser_handledare_idx on lia_platser (handledare_id);
create index if not exists lia_platser_status_idx     on lia_platser (status);

-- Vilka utbildningar platsen tar emot från (när open_to = 'valda')
create table if not exists plats_educations (
  id           uuid primary key default gen_random_uuid(),
  plats_id     uuid not null references lia_platser(id) on delete cascade,
  education_id uuid not null references educations(id) on delete cascade,
  created_at   timestamptz not null default now(),
  unique (plats_id, education_id)
);

-- ---------------------------------------------------------------
-- 3. Koppla om placements.handledare_id, och koppla på platsen
-- ---------------------------------------------------------------
-- handledare_id pekade på company_members, alltså på ett konto. Nu pekar
-- den på handledarposten, som finns även utan konto. Kolumnen är tom i dag,
-- så omkopplingen är gratis. Om detta fel­ar finns det redan rader — säg till
-- i stället för att forcera.

alter table placements drop constraint if exists placements_handledare_id_fkey;

alter table placements
  add constraint placements_handledare_id_fkey
  foreign key (handledare_id) references handledare(id) on delete set null;

alter table placements
  add column if not exists plats_id uuid references lia_platser(id) on delete set null;

alter table matches
  add column if not exists plats_id uuid references lia_platser(id) on delete set null;

create index if not exists placements_handledare_idx on placements (handledare_id);
create index if not exists matches_plats_idx         on matches (plats_id);

-- ---------------------------------------------------------------
-- 4. Hjälpfunktioner för RLS
-- ---------------------------------------------------------------
-- Alla policyvillkor går genom SECURITY DEFINER-funktioner. Läser en policy
-- direkt ur companies eller company_members utlöses de tabellernas egna
-- policyer och vi får rekursion och 500-fel.

create or replace function mina_foretag()
returns setof uuid
language sql
security definer
stable
set search_path = public
as $$
  select id from companies where user_id = auth.uid()
  union
  select company_id from company_members where user_id = auth.uid()
$$;

create or replace function ar_foretagsadmin(p_company uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from companies
    where id = p_company and user_id = auth.uid()
  ) or exists (
    select 1 from company_members
    where company_id = p_company
      and user_id = auth.uid()
      and member_role = 'admin'
  )
$$;

create or replace function mina_handledarposter()
returns setof uuid
language sql
security definer
stable
set search_path = public
as $$
  select id from handledare where user_id = auth.uid()
$$;

-- Företag som utbildningspersonalen får se: partners till mina utbildningar
-- eller min skola, plus företag som redan har en placering hos mig.
create or replace function foretag_i_mitt_natverk()
returns setof uuid
language sql
security definer
stable
set search_path = public
as $$
  select ep.company_id
  from education_partners ep
  where ep.education_id in (
          select education_id from education_staff
          where user_id = auth.uid() and coalesce(aktiv, true)
        )
     or ep.school_id in (
          select e.school_id
          from education_staff es
          join educations e on e.id = es.education_id
          where es.user_id = auth.uid() and coalesce(es.aktiv, true)
          union
          select school_id from school_staff
          where user_id = auth.uid() and coalesce(aktiv, true)
        )
  union
  select p.company_id
  from placements p
  join lia_periods lp on lp.id = p.lia_period_id
  join classes c      on c.id  = lp.class_id
  where p.company_id is not null
    and c.education_id in (
          select education_id from education_staff
          where user_id = auth.uid() and coalesce(aktiv, true)
        )
$$;

create or replace function platsen_ar_min(p_plats uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from lia_platser lp
    where lp.id = p_plats
      and (
        ar_foretagsadmin(lp.company_id)
        or lp.handledare_id in (select id from handledare where user_id = auth.uid())
      )
  )
$$;

-- ---------------------------------------------------------------
-- 5. RLS
-- ---------------------------------------------------------------

alter table handledare       enable row level security;
alter table lia_platser      enable row level security;
alter table plats_educations enable row level security;

-- Handledare -----------------------------------------------------

drop policy if exists "Foretaget ser sina handledare" on handledare;
create policy "Foretaget ser sina handledare" on handledare
  for select using (company_id in (select mina_foretag()));

drop policy if exists "Utbildning ser natverkets handledare" on handledare;
create policy "Utbildning ser natverkets handledare" on handledare
  for select using (company_id in (select foretag_i_mitt_natverk()));

drop policy if exists "Admin ser alla handledare" on handledare;
create policy "Admin ser alla handledare" on handledare
  for select using (ar_admin());

drop policy if exists "Handledaren ser sin egen rad" on handledare;
create policy "Handledaren ser sin egen rad" on handledare
  for select using (user_id = auth.uid());

drop policy if exists "Foretagsadmin lagger till handledare" on handledare;
create policy "Foretagsadmin lagger till handledare" on handledare
  for insert with check (ar_foretagsadmin(company_id));

-- UL skriver in handledaren i avtalet, så hon måste kunna skapas därifrån.
drop policy if exists "Utbildning lagger till handledare hos partner" on handledare;
create policy "Utbildning lagger till handledare hos partner" on handledare
  for insert with check (company_id in (select foretag_i_mitt_natverk()));

drop policy if exists "Foretagsadmin andrar handledare" on handledare;
create policy "Foretagsadmin andrar handledare" on handledare
  for update using (ar_foretagsadmin(company_id))
  with check (ar_foretagsadmin(company_id));

drop policy if exists "Handledaren andrar sina egna uppgifter" on handledare;
create policy "Handledaren andrar sina egna uppgifter" on handledare
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Foretagsadmin tar bort handledare" on handledare;
create policy "Foretagsadmin tar bort handledare" on handledare
  for delete using (ar_foretagsadmin(company_id));

-- LIA-platser ----------------------------------------------------

drop policy if exists "Foretaget ser sina platser" on lia_platser;
create policy "Foretaget ser sina platser" on lia_platser
  for select using (company_id in (select mina_foretag()));

drop policy if exists "Utbildning ser natverkets platser" on lia_platser;
create policy "Utbildning ser natverkets platser" on lia_platser
  for select using (company_id in (select foretag_i_mitt_natverk()));

-- En öppen plats är en annons. Studenter får se dem.
drop policy if exists "Oppna platser ar synliga" on lia_platser;
create policy "Oppna platser ar synliga" on lia_platser
  for select using (status = 'oppen');

drop policy if exists "Foretagsadmin hanterar platser" on lia_platser;
create policy "Foretagsadmin hanterar platser" on lia_platser
  for all using (ar_foretagsadmin(company_id))
  with check (ar_foretagsadmin(company_id));

drop policy if exists "Handledaren hanterar sina platser" on lia_platser;
create policy "Handledaren hanterar sina platser" on lia_platser
  for all using (handledare_id in (select mina_handledarposter()))
  with check (
    handledare_id in (select mina_handledarposter())
    and company_id in (select mina_foretag())
  );

-- plats_educations -----------------------------------------------

drop policy if exists "Ser plats_educations" on plats_educations;
create policy "Ser plats_educations" on plats_educations
  for select using (true);

drop policy if exists "Hanterar plats_educations" on plats_educations;
create policy "Hanterar plats_educations" on plats_educations
  for all using (platsen_ar_min(plats_id))
  with check (platsen_ar_min(plats_id));

-- ---------------------------------------------------------------
-- 6. Datamigrering
-- ---------------------------------------------------------------

-- 6a. Handledare ur befintliga avtal. Fritexten blir en post.
insert into handledare (company_id, name, email, phone)
select distinct on (a.company_id, lower(coalesce(a.handledare_email, '')))
       a.company_id,
       a.handledare_name,
       nullif(a.handledare_email, ''),
       nullif(a.handledare_phone, '')
from agreements a
where a.company_id is not null
  and nullif(a.handledare_name, '') is not null
order by a.company_id,
         lower(coalesce(a.handledare_email, '')),
         a.created_at
on conflict do nothing;

-- 6b. Koppla placeringen till handledarposten
update placements p
set handledare_id = h.id
from agreements a
join handledare h
  on h.company_id = a.company_id
 and lower(coalesce(h.email, '')) = lower(coalesce(a.handledare_email, ''))
where a.placement_id = p.id
  and p.handledare_id is null;

-- 6c. En plats per företag ur nuvarande behov. Titeln får bytas i gränssnittet.
insert into lia_platser (
  company_id, titel, beskrivning, bransch, ort,
  period_start, period_end, antal, antal_lediga, open_to
)
select c.id,
       'LIA-plats',
       nullif(c.looking_for, ''),
       c.sector,
       c.city,
       c.lia_period_start,
       c.lia_period_end,
       greatest(coalesce(c.spots_total, 1), 1),
       greatest(coalesce(c.spots_available, c.spots_total, 1), 0),
       coalesce(c.open_to, 'alla')
from companies c
where not exists (
  select 1 from lia_platser lp where lp.company_id = c.id
);

-- 6d. Ärv vilka utbildningar företaget valt. Giltigt så länge varje företag
--     har exakt en plats, vilket är sant direkt efter 6c.
insert into plats_educations (plats_id, education_id)
select lp.id, ce.education_id
from lia_platser lp
join company_educations ce on ce.company_id = lp.company_id
on conflict do nothing;

commit;

-- ---------------------------------------------------------------
-- Kontroll efteråt
-- ---------------------------------------------------------------
-- select count(*) as handledare from handledare;
-- select count(*) as platser from lia_platser;
-- select count(*) as kopplade_placeringar from placements where handledare_id is not null;
