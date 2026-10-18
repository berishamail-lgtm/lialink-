# Vidareutveckling

## Läget när detta skrivs

Plattformen fungerar i produktion men har aldrig haft en riktig användare.
Varje flöde är testat manuellt av ägaren i alla fem roller. Det finns inga
automatiska tester.

---

## Det som saknas och som jag skulle göra först

**En testsvit.** Inga enhetstester, inga e2e-tester. Med fem roller, Row
Level Security och ett avtalsflöde i flera steg är manuell testning det enda
som hållit kvaliteten uppe, och det skalar inte. Playwright finns redan som
beroende i projektet.

**Grundschemat som migreringsfil.** Tabellerna som fanns före oktober 2026
byggdes i Supabases gränssnitt och finns inte som kod. Det går inte att resa
en ny miljö från repot i dag. Ta en `pg_dump --schema-only` och spara den
som `sql/000-grundschema.sql`.

**En stagingmiljö.** Det finns bara produktion. Varje push till `main` går
till lialink.se. Ett andra Supabase-projekt och en preview-deploy i Vercel
skulle ta en förmiddag och ta bort en hel kategori av risk.

**Felhantering som syns.** Flera ställen fångar fel och går vidare tyst. När
något inte fungerar får användaren en tom lista i stället för ett besked.

---

## Halvfärdigt

**Äldre fält på `companies`.** `looking_for`, `spots_total`,
`spots_available`, `lia_period_start`, `lia_period_end` och `open_to` är
ersatta av `lia_platser` men används fortfarande som reserv när en plats
saknar egna värden. De bör fasas ut när alla företag har riktiga platser.

**`company_educations`** är ersatt av `plats_educations` men läses
fortfarande på företagsprofilen.

**Chatten är personbunden.** `conversation_id` byggs av två användares id.
Det var ett medvetet val — en gemensam företagsinkorg blir en inkorg ingen
äger — men det betyder att en tråd försvinner om personen slutar. Rätt
lösning på sikt är att knyta tråden till placeringen och låta den följa med
när handledaren byts, på samma sätt som `education_staff` löste det för
utbildningsledare.

**Handledare utan konto kan inte nås i appen.** De kan bara mejlas. Knappen
byter skepnad beroende på om kontot finns, vilket är tydligt men inte
elegant.

---

## Planerat för version 2

Dokumenterat separat i `LIAlink-version-2.docx` hos ägaren. I korthet:

**Verksamhetschefsvy** — bemanning och beläggning över alla utbildningar på
skolan, inte bara en i taget.

**Anbudsteamets modul** — avsiktsförklaringar från företag inför nya
YH-ansökningar, med koppling till det befintliga nätverket.

**Relationsvärme** — hur aktiv relationen med ett företag är över tid, inte
bara om de finns i listan.

En klickbar skiss av chefs- och anbudsvyerna finns publicerad som artefakt
hos ägaren.

---

## Idéer som diskuterats men inte beslutats

- Automatiska påminnelser till studenter som har matchningar men inte hört av
  sig. Knappen finns, det automatiska utskicket är medvetet inte byggt.
- Inloggningsräknare per student. Valdes bort: inloggningar mäter fel sak,
  och det är personuppgiftsbehandling med tunt syfte. Endast "senast aktiv"
  visas.
- Studenter som ser och söker öppna LIA-platser själva, som en annonstavla.
  Policyn tillåter det redan — `lia_platser` med status `oppen` är läsbara —
  men inget gränssnitt är byggt.

---

## Kommersiella överväganden

Plattformen är byggd av en anställd utbildningsledare, i eget bolag, med en
tilltänkt första kund som är den egna arbetsgivaren. Det är en intressekonflikt
som måste hanteras öppet och i förväg, inte upptäckas av någon annan.

Prisnivån som diskuterats ligger på 18 000–24 000 kronor per år och
utbildning, för upp till fyrtio studenter.

Innan plattformen kan säljas till en skola krävs ett
personuppgiftsbiträdesavtal. Utkast finns framtaget men är inte granskat av
ett dataskyddsombud.

En nollmätning saknas: hur många timmar LIA-samordningen tar i dag, och hur
stor andel av handledarna som svarar på utvärderingen. Utan de två talen går
det inte att visa vad plattformen är värd, och de går inte att mäta i
efterhand.

---

## Om du fortsätter med en AI-assistent

Ge den `00-START-HAR.md` och `05-fallgropar.md` först. Fallgroparna är det
som annars upprepas.

Tre arbetssätt som fungerade bra under bygget och som är värda att behålla:

**Hela filer, inte fragment.** Punktvisa ändringar mitt i en fil blev fel
oftare än de blev rätt. Skriv ut hela filen, eller gör ändringen med ett
kommando som inte kan missförstås.

**Kontrollera mot databasen i stället för att gissa.** Varje gång ett
kolumnnamn antogs i stället för att slås upp blev det fel.

**Kör `npm run build` lokalt innan push.** Ett typfel syns på tio sekunder
lokalt, eller efter två minuter i en misslyckad deploy.
