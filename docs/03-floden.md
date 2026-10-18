# Flödena

Vad som faktiskt händer, steg för steg, och vilken kod som kör.

## Studenten får en LIA-plats

```
1. UL bjuder in                 api/lagg-till-student  →  mejl med länk
2. Studenten sätter lösenord    register/ eller länken i mejlet
3. Bekräftar e-post             Supabase Auth skickar bekräftelsemejl
4. Fyller i profilen            dashboard/student/profil
   - anger YH-koden             → hittar klassen
   - kompetenser, bio, ort
   - laddar upp CV och PB       → Storage, hinken dokument
   → en placering skapas per LIA-period, status söker
5. UL kör matchningen           api/match
   → matches-rader, mejl till student och företag vid 60 poäng eller mer
6. Studenten kontaktar företag  dashboard/messages
7. Företaget svarar och anmäler dashboard/company → Vi tar emot
   → api/platsanmalan, placeringen blir förslag, UL får mejl
8. UL skapar avtalet            dashboard/agreements/skapa
   → handledaren skapas         api/avtal-handledare
   → placeringen blir avtal
9. Alla tre signerar            api/signera → all_signed, PDF genereras
10. LIA pågår                   placeringen sätts till aktiv
11. Perioden tar slut           api/skicka-utvardering → handledaren får länk
12. Utvärderingen fylls i       utvardering/[token], ingen inloggning
13. Tack till handledaren       api/tack-handledare
14. MYH-underlag                dashboard/rapporter → api/export
```

## Matchningen

Körs av UL från utbildningsvyn, eller av det dagliga cron-jobbet.
Koden ligger i `app/api/match/route.ts`.

För varje placering med status `söker` eller `uppskjuten`, och varje **öppen
LIA-plats** hos ett företag med konto:

| Del | Poäng | Så räknas den |
| --- | --- | --- |
| Ort | 30 | Samma ort ger 30, olika orter ger 8 |
| Kompetenser | 30 | Hur stor del av platsens kompetenslista studenten har. Saknar platsen lista söks i titel och beskrivning |
| Period | 25 | Hur stor del av studentens period som överlappar platsens |
| Bransch | 15 | Om utbildningens namn och platsens bransch delar ett ord |

Tre trösklar styr vad som händer:

- **20 poäng** — matchningen sparas i databasen
- **60 poäng** — mejl skickas till studenten och företaget
- **80 mejl** — taket per körning, en marginal mot Resends dygnsgräns på 100

Ett företag med tre platser dyker upp **en gång** per student, med den plats
som gav högst poäng. `matches.plats_id` pekar på den platsen, och
kandidatlistan visar dess titel.

Platser med `open_to = 'valda'` matchas bara mot utbildningar som står i
`plats_educations`.

## Företaget kommer in i systemet

Två vägar.

**UL bjuder in.** UL lägger till företaget i nätverket, klickar Bjud in →
`api/bjud-in` skapar en rad i `company_invites` och mejlar en tokenlänk →
företaget öppnar `valkommen/[token]`, sätter lösenord → `api/koppla-foretag`
skapar profilraden med servernyckeln och sätter `companies.user_id`.

Profilraden måste skapas på servern eftersom e-posten är obekräftad i det
ögonblicket och det alltså inte finns någon session. Se `05-fallgropar.md`.

**Företaget registrerar sig självt** från startsidan. Då finns ingen
inbjudan, och företaget får fylla i sin profil från början.

## Handledaren

En handledare är i första hand en **post hos företaget**, inte ett konto.
Hon skapas på två sätt:

- Företagsadmin lägger till henne under Handledare
- UL skriver in namn och e-post i ett avtal → `api/avtal-handledare` skapar
  posten om den inte finns, och sätter `placements.handledare_id`

Kontot är frivilligt och kommer separat: företagsadmin klickar Bjud in till
konto → `api/bjud-in-handledare` → `member_invites` → `handledare/[token]` →
`api/koppla-handledare` skapar profil och `company_members`, och kopplar
kontot till handledarposten via e-postadressen.

En inloggad handledare ser **bara sina egna studenter** — de placeringar där
`handledare_id` är hennes post. Hon ser företagets alla LIA-platser men kan
bara ändra sina egna, och kan inte spara företagsprofilen. Den spärren finns
både i gränssnittet och i RLS.

## Avtalet

```
dashboard/agreements/skapa
  ├─ väljer placering och företag
  ├─ väljer befintlig handledare eller skriver in en ny
  ├─ kryssruta: bjud in handledaren till konto (av som standard)
  └─ sparar
       ├─ agreements-raden skapas, status skickat
       ├─ placeringen blir avtal
       ├─ api/avtal-handledare: handledarposten + handledare_id
       ├─ api/bjud-in-handledare om kryssrutan var i
       └─ api/avtal-notis: mejl till student och företag

signering: api/signera, en part i taget
  → student_signed_at, company_signed_at, education_signed_at
  → när alla tre är satta: all_signed = true, api/avtal-pdf genererar PDF
```

IP-adressen sparas vid varje signering som spår.

## Det dagliga cron-jobbet

`vercel.json` kör `/api/cron` klockan 07:00 varje dag. Den:

- påminner om avtal som inte signerats
- skickar utvärderingsformulär till handledare vars LIA-period just tagit slut
- skickar tack till handledare efter avslutad period

## Rollerna och vad de ser

| | Student | Företagsadmin | Handledare | UL | Skolpersonal | Admin |
| --- | --- | --- | --- | --- | --- | --- |
| Egen profil | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Matchningar | sina | företagets | — | utbildningens | — | alla |
| LIA-platser | öppna | företagets, ändrar alla | företagets, ändrar sina | nätverkets | nätverkets | alla |
| Studenter | — | kandidater | sina egna | utbildningens | — | alla |
| Företagsnätverk | — | — | — | skolans | skolans | alla |
| Handledarnätverk | — | — | — | skolans | skolans | alla |
| Avtal | sina | företagets | — | utbildningens | — | alla |
| MYH-underlag | — | — | — | per utbildning | — | alla |
| Administration | — | — | — | — | — | ✓ |

Skolpersonal utan egen utbildning — anbudsteam — ser bara nätverksflikarna.
Det styrs av `endast_natverk` i `EduContext`, som filtrerar sidomenyn.

## Den delade kontexten

`app/components/EduContext.tsx` håller vilken utbildning UL arbetar med.
Den hämtar utbildningar via `education_staff`, och faller tillbaka på
`school_staff` med en pseudo-utbildning märkt `endast_natverk` för den som
bara arbetar på skolnivå.

Den använder `getSession()` plus `onAuthStateChange`, inte `getUser()`.
Skälet står i `05-fallgropar.md`.

`app/lib/foretag.ts` gör motsvarande för företagssidan: hittar användarens
företag via ägarskap först, medlemskap sedan, och returnerar rollen. Alla
företagssidor går via den funktionen. Gör de inte det ser en handledare
ingenting och riskerar att skapa ett dubblettföretag.
