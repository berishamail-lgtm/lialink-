-- Hindra att samma bolag hamnar två gånger i companies
-- 2026-10-09
--
-- UL lägger in Volvo i nätverket. Volvo registrerar sig själva från
-- startsidan. Utan unikt index blir det två rader för samma arbetsgivare,
-- och matchning, kontaktlogg och biträdesavtal splittras mellan dem.

-- ── 1. Finns det dubbletter redan? Kör den här först. ──────────
-- Får du rader tillbaka måste de slås ihop innan indexet kan skapas.

select
  regexp_replace(org_number, '\D', '', 'g') as rensat_orgnr,
  count(*)                                  as antal,
  string_agg(company_name || ' (' || id::text || ')', ' | ') as rader
from companies
where nullif(trim(org_number), '') is not null
group by 1
having count(*) > 1;

-- ── 2. Skapa indexet ───────────────────────────────────────────
-- Siffrorna jämförs utan bindestreck, så 556012-3456 och 5560123456
-- räknas som samma bolag. Företag utan organisationsnummer berörs inte.

create unique index if not exists companies_orgnr_unikt
  on companies (regexp_replace(org_number, '\D', '', 'g'))
  where nullif(trim(org_number), '') is not null;
