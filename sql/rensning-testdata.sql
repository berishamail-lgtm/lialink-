-- LIAlink: rensning av all testdata inför skarp drift
--
-- Kör INTE det här utan att först ha läst dokumentet "Rensning inför skarp
-- drift". Där står inventeringen du ska göra innan, säkerhetskopian, samt
-- stegen för Storage och kvarglömda auth-konton som inte ryms här.
--
-- Allt körs i en transaktion. Faller något rullas hela körningen tillbaka.

begin;

-- ===== Fyll i vilka konton som ska överleva =====
create temp table behall_profil on commit drop as
select id from profiles
where lower(email) in (
  'berisha.mail@gmail.com'
  -- , 'lernia-kontots-adress@exempel.se'
);

do $$
begin
  if (select count(*) from behall_profil) = 0 then
    raise exception 'Inget konto matchade listan. Kontrollera adresserna innan du kör igen.';
  end if;
end $$;

-- Utbildningar och skolor som hör till de kontona
create temp table behall_edu on commit drop as
select id, school_id from educations
where user_id in (select id from behall_profil);

create temp table behall_skola on commit drop as
select distinct school_id from behall_edu where school_id is not null;

-- ===== Töm aktivitetstabellerna, barn före förälder =====
-- Tabeller som inte finns hoppas över i stället för att stoppa skriptet.
do $$
declare t text;
begin
  foreach t in array array[
    'messages', 'matches', 'platsanmalan', 'evaluations', 'intressesvar',
    'agreements', 'placements', 'students',
    'plats_educations', 'lia_platser', 'handledare',
    'company_members', 'company_invites', 'member_invites',
    'partner_contacts', 'partner_educations', 'education_partners',
    'company_educations', 'companies'
  ]
  loop
    if to_regclass('public.' || t) is not null then
      execute format('delete from public.%I', t);
    end if;
  end loop;
end $$;

-- ===== Struktur som inte tillhör de sparade kontona =====
delete from lia_periods
where class_id in (
  select id from classes where education_id not in (select id from behall_edu)
);

delete from classes
where education_id not in (select id from behall_edu);

delete from education_staff
where education_id not in (select id from behall_edu);

delete from school_staff
where school_id not in (select school_id from behall_skola);

delete from educations
where id not in (select id from behall_edu);

delete from schools
where id not in (select school_id from behall_skola);

-- ===== Konton =====
delete from profiles
where id not in (select id from behall_profil);

-- Klagar den här raden på rättigheter: ta bort den, kör skriptet ändå, och
-- radera kontona under Authentication, Users i Supabase i stället.
delete from auth.users
where id not in (select id from behall_profil);

commit;

-- ===== Efter commit: filerna i Storage =====
-- delete from storage.objects where bucket_id = 'dokument';

-- ===== Kontroll =====
-- select
--   (select count(*) from profiles)    as profiler,
--   (select count(*) from companies)   as foretag,
--   (select count(*) from students)    as studenter,
--   (select count(*) from placements)  as placeringar,
--   (select count(*) from handledare)  as handledare,
--   (select count(*) from lia_platser) as platser,
--   (select count(*) from messages)    as meddelanden,
--   (select count(*) from schools)     as skolor,
--   (select count(*) from educations)  as utbildningar,
--   (select count(*) from classes)     as klasser;
