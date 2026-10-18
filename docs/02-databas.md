# Databasen

PostgreSQL hos Supabase. Allt ligger i schemat `public` utom inloggningarna,
som ligger i Supabases eget `auth`.

## Översikt

```
auth.users ──1:1── profiles ─┬─── students ──── placements ──── agreements
                             │                      │  │
                             │                      │  └──── matches
                             │                      │  └──── platsanmalan
                             │                      │
                             ├─── companies ───┬── lia_platser ── plats_educations
                             │                 ├── handledare ────┘
                             │                 ├── company_members
                             │                 ├── company_educations
                             │                 └── company_invites / member_invites
                             │
                             ├─── education_staff ──── educations ──── classes ──── lia_periods
                             │                             │
                             └─── school_staff ──── schools┘

educations ──── education_partners ──┬── partner_contacts
    (nätverket)                       └── partner_educations
```

## Tabellerna

### Identitet

**`profiles`** — en rad per inloggning, samma id som `auth.users`.
`id, email, role, full_name, city, phone, avatar_url, is_admin, created_at,
deleted_at, deletion_reason`

`role` är `student`, `company` eller `education`. `is_admin` är en separat
flagga ovanpå rollen — en admin har också en vanlig roll.

Profilraden skapas normalt av klienten efter inloggning, men när ett konto
skapas via en inbjudan finns ingen session (e-posten är obekräftad), så då
skapas den av serverrouten i stället. Se `05-fallgropar.md`.

### Skola och utbildning

**`schools`** — `id, name, org_number, status, avtal_tecknat, godkand_av,
godkand_at, admin_note, created_at`

**`educations`** — en YH-utbildning. `id, school_id, user_id, school_name,
program_name, program_code, city, students_count, lia_period_start,
lia_period_end, myh_number, org_number, phone, contact_phone, villkor_text,
status, avtal_tecknat, godkand_av, godkand_at, admin_note, active`

`user_id` är den som skapade utbildningen. Vem som **arbetar** med den styrs av
`education_staff`.

**`education_staff`** — `id, education_id, user_id, roll, aktiv,
tilldelad_at, avslutad_at`. Den här tabellen är skälet till att en
utbildningsledare kan sluta utan att utbildningen tappar sin data.

**`school_staff`** — `id, school_id, user_id, roll, aktiv, created_at`. För
personal som arbetar på skolnivå, till exempel anbudsteam, utan egen utbildning.

**`classes`** — `id, education_id, name, yh_kod, start_date, end_date, termin`.
`yh_kod` är den kod studenten anger vid registrering för att hamna i rätt klass,
och den följer med i MYH-underlaget.

**`lia_periods`** — `id, class_id, name, sequence, start_date, end_date, weeks`.

### Student

**`students`** — `id, user_id, class_id, program, bio, skills (text[]),
cv_path, pb_path, cv_uppladdad, pb_uppladdad, status`

`cv_path` och `pb_path` pekar in i Storage-hinken `dokument`.

**`placements`** — en student i en LIA-period. `id, student_id, lia_period_id,
company_id, status, source, note, ul_note, actual_start, actual_end,
handledare_id, tack_skickat_at`

`status` går `söker` → `förslag` → `avtal` → `aktiv` → `klar`, med
`uppskjuten` och `avbruten` som sidospår. En placering skapas per LIA-period
när studenten fyller i sin profil.

`handledare_id` pekar på `handledare`, inte på ett konto — handledaren behöver
inget konto för att stå på placeringen.

### Företag

**`companies`** — organisationen. `id, user_id, company_name, org_number,
sector, description, city, address, website, spots_total, spots_available,
lia_period_start, lia_period_end, looking_for, contact_name, contact_email,
contact_phone, phone, origin, claimed, open_to, anonymized`

`user_id` är ägaren, den som skapade kontot. `claimed` är sant när någon
faktiskt tagit kontot i bruk. `origin` säger om företaget lades in av en UL
eller registrerade sig självt.

Fälten `looking_for`, `spots_total`, `lia_period_start/end` och `open_to` är
**äldre modell**. Behoven ligger numera i `lia_platser`. Kolumnerna är kvar som
reserv för platser som inte fyllt i sina egna värden, men nya funktioner ska
läsa `lia_platser`.

**`company_members`** — vilka konton som får logga in för ett företag.
`id, company_id, user_id, member_role, created_at`. `member_role` är `admin`
eller `handledare`.

**`handledare`** — en person hos företaget. `id, company_id, name, email,
phone, roll, user_id, aktiv, note, created_at`

`user_id` är valfri. En handledare som aldrig loggar in räknas ändå, står på
avtalet och syns i UL:s handledarnätverk. Unikt index på
`(company_id, lower(email))` när e-post finns.

**`lia_platser`** — ett LIA-behov. `id, company_id, handledare_id, titel,
beskrivning, kompetenser (text[]), bransch, ort, period_start, period_end,
antal, antal_lediga, open_to, status, created_by`

`status` är `oppen`, `pausad` eller `fylld`. `open_to` är `alla` eller `valda`;
vid `valda` styr `plats_educations` vilka utbildningar platsen tar emot från.

**`company_educations`** — äldre motsvarighet på företagsnivå. Kvar för
bakåtkompatibilitet.

**`company_invites`** — inbjudan till företagskonto. Token i mejlet.
**`member_invites`** — inbjudan till handledarkonto. Samma mönster.

### Nätverket

**`education_partners`** — ett företag i en skolas eller utbildnings nätverk.
`id, education_id, school_id, company_id, note, utskick, aktiv, kalla,
created_at`

**`partner_contacts`** — kontaktpersoner hos partnern. `id, partner_id, name,
role, email, phone, aktiv, note`

**`partner_educations`** — vilka utbildningar partnern är relevant för, och vad
de erbjuder. `id, partner_id, education_id, erbjuder (text[])`

`erbjuder` innehåller `lia`, `forelasning`, `studiebesok`, `ledning`,
`avsikt`.

### Process

**`matches`** — en matchning mellan student och företag.
`id, student_id, company_id, placement_id, plats_id, score, score_city,
score_skills, score_period, score_sector, status, notis_skickad_at`

En rad per student och företag, aldrig flera, även om företaget har flera
platser. `plats_id` pekar på den plats som gav högst poäng.

**`platsanmalan`** — företaget anmäler att de tar emot en student.
`placement_id, company_id, user_id, status, meddelande`

**`agreements`** — LIA-avtalet. `id, placement_id, student_id, company_id,
education_id, lia_start, lia_end, handledare_name, handledare_email,
handledare_phone, student_address, student_phone, student_ort, company_ort,
education_ort, sarskilda_villkor, status, pdf_url, notes, avbrutet_skal,
avbrutet_at, notis_skickad_at, paminnelse_skickad_at`, samt
`student_signed_at/ip`, `company_signed_at/ip`, `education_signed_at/ip` och
`all_signed`.

**`messages`** — chatten. `conversation_id, from_user_id, to_user_id, body,
is_read, education_id, created_at`

`conversation_id` är en textkolumn som bildas av de två användarnas id,
sorterade och hopslagna. Tråden tillhör alltså två personer, inte två
organisationer. Det var ett medvetet val: en gemensam företagsinkorg som
alla ser blir en inkorg ingen äger.

**`evaluations`** — handledarens utvärdering efter avslutad LIA. Nås via
tokenlänk utan inloggning.

**`intressesvar`** — svar på intresseförfrågan, också via tokenlänk.

## Behörigheter: Row Level Security

Varje tabell har RLS påslagen. En fråga från webbläsaren ser bara de rader
policyn släpper igenom.

**Den viktigaste regeln i hela projektet:** en policy får aldrig läsa sin egen
tabell, och två policyer får aldrig läsa varandras tabeller. Det ger oändlig
rekursion och 500-fel som ser ut som allt möjligt annat. Lösningen som används
genomgående är `SECURITY DEFINER`-funktioner, som kör med ägarens rättigheter
och därför går förbi policyn.

### Hjälpfunktionerna

| Funktion | Svarar på |
| --- | --- |
| `ar_admin()` | Är den inloggade administratör? |
| `har_utbildning(uuid)` | Arbetar den inloggade med den här utbildningen? |
| `ar_ansvarig(uuid)` | Är den inloggade ansvarig för utbildningen? |
| `har_skola(uuid)` | Tillhör den inloggade skolan? |
| `foretag_ser_student(uuid)` | Får det här företaget se studenten? |
| `ar_personal_utvardering(uuid)` | Får den inloggade läsa utvärderingen? |
| `mina_foretag()` | Vilka företag äger eller tillhör den inloggade? |
| `ar_foretagsadmin(uuid)` | Får den inloggade administrera företaget? |
| `mina_handledarposter()` | Vilka handledarposter är den inloggades egna? |
| `foretag_i_mitt_natverk()` | Vilka företag får utbildningspersonalen se? |
| `platsen_ar_min(uuid)` | Får den inloggade ändra den här LIA-platsen? |

Alla är `language sql security definer stable set search_path = public`.
`set search_path` är inte kosmetik — utan den kan funktionen luras att läsa
fel schema.

### Tokensidor

Sidor som nås via en länk i ett mejl har ingen inloggad användare. De tabeller
de läser behöver en policy av formen `for select using (true)`. Det låter
osäkert men är det inte: token är långt och slumpmässigt, och det är token som
är säkerheten. Det gäller `company_invites`, `member_invites`, `evaluations`
och `intressesvar`.

### Vanliga misstag

En `for all`-policy utan `with check` blockerar alla insert. Policyer med
samma kommando kombineras med ELLER, så en extra policy kan bara öppna, aldrig
stänga. En `update`-policy behöver både `using` och `with check`, annars nekas
skrivningen trots att raden syns.

## Migreringarna

Kör i den här ordningen på en tom databas. Filerna ligger i `sql/`.

| Fil | Vad den gör |
| --- | --- |
| `2026-10-09-handledare-platser.sql` | Inför `handledare` och `lia_platser`, kopplar om `placements.handledare_id`, lägger hjälpfunktionerna och policyerna, migrerar befintliga behov till platser |
| `2026-10-09-unikt-orgnummer.sql` | Unikt index på organisationsnummer så samma bolag inte kan finnas två gånger |
| `rensning-testdata.sql` | Tömmer all testdata inför skarp drift. Körs en gång, inte som migrering |

Grundschemat — tabellerna som fanns före dessa — byggdes stegvis i Supabases
gränssnitt och finns inte som en enda migreringsfil. **Det är en skuld.** Ska
du sätta upp en ny miljö, ta en `pg_dump --schema-only` från den befintliga
databasen och spara den som utgångspunkt.
