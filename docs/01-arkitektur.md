# Arkitektur

## Delarna

```
Besökare
   │
   ├─ lialink.se  ──────────►  Vercel  ──────────►  Next.js 16 (App Router, Turbopack)
   │                              │                      │
   │                              │                      ├─ Klientsidor      (app/dashboard/..., app/login, ...)
   │                              │                      └─ API-routes       (app/api/...)
   │                              │                              │
   │                              └─ Cron, dagligen 07:00 ───────┘
   │                                                             │
   │                                      ┌──────────────────────┴───────────────────┐
   │                                      │                                          │
   └──────────────────────────────►   Supabase                                    Resend
                                      - PostgreSQL                               - transaktionsmejl
                                      - Auth                                     - avsändare noreply@lialink.se
                                      - Storage (CV, personligt brev)
                                      - Row Level Security
```

Domänen ligger hos **Loopia**, som pekar mot Vercel. DKIM, SPF och DMARC för
Resend ligger också som DNS-poster hos Loopia.

## Teknikval

| Del | Val | Varför |
| --- | --- | --- |
| Ramverk | Next.js 16.3.4, App Router | Sidor och API i samma projekt, en deploy |
| Språk | TypeScript | Fångar fel i bygget i stället för i produktion |
| Stil | Tailwind CSS v4 | Designtokens i `app/globals.css` |
| Databas | Supabase (PostgreSQL) | Auth, databas, filer och realtid i en tjänst |
| Hosting | Vercel | Deploy vid varje push till `main` |
| Mejl | Resend | Verifierad avsändardomän, enkel API |
| PDF | pdf-lib | Avtal och utvärderingar genereras i Node |
| Excel | xlsx | MYH-underlaget exporteras per utbildning |

## Hur en sida hämtar data

Nästan varje sida är en **klientkomponent** (`'use client'`) som själv pratar
med Supabase genom webbläsaren. Behörigheten avgörs av Row Level Security i
databasen, inte av koden i sidan.

```
app/dashboard/students/page.tsx
   └─ createClient()  →  supabase.from('students').select(...)
                             └─ RLS avgör vilka rader som kommer tillbaka
```

Det betyder två saker du måste ha med dig:

1. **En tom lista är oftast en policy, inte en bugg.** Får du noll rader där du
   väntar dig data, kontrollera policyn innan du felsöker frontend.
2. **Koden kan inte läcka data som policyn inte släpper igenom.** Det är
   avsiktligt. Men det betyder också att en ny vy inte fungerar förrän någon
   skrivit en policy för den.

## När servernyckeln behövs

Vissa saker kan inte göras från webbläsaren: skicka mejl, läsa inloggningstider
ur `auth`, eller skriva data åt en användare som ännu inte har en session. De
ligger som API-routes och använder `SUPABASE_SERVICE_ROLE_KEY`, som går förbi
all RLS.

| Route | Vad den gör | Varför server |
| --- | --- | --- |
| `api/bjud-in` | Bjuder in ett företag till konto | Skickar mejl |
| `api/bjud-in-handledare` | Bjuder in en handledare till konto | Skickar mejl |
| `api/koppla-foretag` | Kopplar nytt konto till rätt företag | Ingen session finns än, e-posten är obekräftad |
| `api/koppla-handledare` | Kopplar nytt handledarkonto | Samma skäl |
| `api/avtal-handledare` | Skapar handledarposten från avtalet | Skriver över företagsgräns |
| `api/match` | Kör matchningen och skickar sammanfattningsmejl | Läser alla företag, skickar mejl |
| `api/platsanmalan` | Företaget anmäler att de tar emot | Mejlar utbildningsledaren |
| `api/skicka-avtal`, `api/signera`, `api/avtal-pdf` | Avtalsflödet | PDF-generering och mejl |
| `api/skicka-utvardering`, `api/utvardering`, `api/utvardering-pdf` | Utvärderingar | Tokenlänkar och PDF |
| `api/tack-handledare` | Tackmejl efter avslutad LIA | Mejl |
| `api/intresseforfragan` | Intresseförfrågan till företag | Mejl och tokenlänk |
| `api/natverk-utskick` | Utskick till företagsnätverket | Mejl |
| `api/student-aktivitet` | Aktivitetsöversikt per student | Läser inloggningstider ur `auth` |
| `api/puffa-student` | Påminnelse till en student | Mejl |
| `api/lagg-till-student`, `api/placera` | UL lägger till och placerar | Skriver åt annan användare |
| `api/export` | MYH-underlag som Excel | Filgenerering |
| `api/radera-konto` | Kontoradering | Raderar i `auth` |
| `api/cron` | Daglig körning | Anropas av Vercel Cron |

**Servernyckeln får aldrig hamna i en klientkomponent.** Den ligger som
miljövariabel i Vercel och i `.env.local` lokalt, och läses bara i filer under
`app/api/`.

## Sidkartan

```
app/
  page.tsx                      startsidan (publik)
  login/                        inloggning
  register/                     registrering
  glomt-losenord/               återställning
  nytt-losenord/                sätt nytt lösenord
  valkommen/[token]/            företaget skapar konto via inbjudan
  handledare/[token]/           handledaren skapar konto via inbjudan
  utvardering/[token]/          handledaren fyller i utvärdering, utan inloggning
  intresse/[token]/             företaget svarar på intresseförfrågan
  integritetspolicy/            GDPR
  anvandarvillkor/              villkor

  dashboard/
    page.tsx                    router: skickar vidare efter roll
    education/                  UL: översikt
    planering/                  UL: perioder och placeringar
    students/                   UL: studentlistan
    aktivitet/                  UL: studentaktivitet och påminnelser
    natverk/                    UL: företagsnätverket (skolnivå)
    handledare/                 UL: handledarnätverket
    agreements/                 avtal, med skapa/
    utvarderingar/              UL: utvärderingar
    rapporter/                  UL: MYH-underlag
    utbildningar/               UL: mina utbildningar
    messages/                   chatt, alla roller
    konto/                      kontoinställningar, alla roller

    student/                    student: min LIA, med profil/
    company/                    företag: kandidater
      platser/                  företag: LIA-platser
      handledare/               företag: handledarna
      historik/                 företag: studenter vi tagit emot
      profil/                   företag: företagsprofil

    admin/                      admin: översikt, anordnare, användare, drift
```

## Tre bärande begrepp

**Utbildning (`educations`)** är arbetsenheten. En utbildningsledare kan ha
flera, och växlar mellan dem i sidomenyn. Allt UL ser filtreras på den valda
utbildningen. Kopplingen mellan person och utbildning ligger i
`education_staff`, inte som en kolumn på utbildningen — det gör att en ny
utbildningsledare kan ta över när någon slutar.

**Skola (`schools`)** är nivån över. Företagsnätverket och biträdesavtalet
hör till skolan, inte till en enskild utbildning. Därför kan en
anbudsansvarig arbeta med nätverket utan att äga någon utbildning alls.

**LIA-plats (`lia_platser`)** är ett behov, inte ett företag. Ett företag som
söker en PLC-programmerare och en fibertekniker har två platser med olika
kompetenskrav och olika handledare. Matchningen poängsätter varje plats för
sig, men visar företaget en gång per student — den plats som passar bäst.
