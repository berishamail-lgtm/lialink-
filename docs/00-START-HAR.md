# LIAlink — börja här

Det här arkivet beskriver LIAlink så att någon som aldrig sett plattformen kan
ta över den. Det är skrivet för två läsare: en utvecklingsbyrå som ska
vidareutveckla, och en AI-assistent som ska fortsätta bygga där den förra
slutade.

**Senast uppdaterad:** 2026-10-18
**Ägare:** Burim Berisha, Newlight AB
**Produktion:** https://lialink.se
**Kodbas:** GitHub, `berishamail-lgtm/lialink-`, branch `main`

---

## Vad LIAlink är

Ett svenskt webbverktyg som samordnar LIA-platser — den praktikperiod som ingår
i varje yrkeshögskoleutbildning. Tre parter möts i samma system:

- **Studenten** fyller i en profil en gång, får matchningsförslag och kontaktar
  företag själv.
- **Företaget** beskriver vilka LIA-behov de har, ser kandidater som passar,
  anmäler att de tar emot någon och signerar avtalet digitalt.
- **Utbildningsledaren (UL)** ser var varje student ligger till, upprättar
  avtal, följer signeringar och exporterar underlag till Myndigheten för
  yrkeshögskolan.

Problemet det löser: LIA-samordning sköts i dag med mejl, kalkylblad och
telefonsamtal. En utbildningsledare med fyrtio studenter lägger stora delar av
en termin på att leta platser och jaga underskrifter, och ingen har överblick
förrän det är för sent.

Plattformen är byggd men **inte tagen i skarp drift**. Den har aldrig haft en
riktig student. All data i databasen när detta skrivs är testdata.

---

## Läs i den här ordningen

| Fil | Vad den svarar på |
| --- | --- |
| `01-arkitektur.md` | Vilka delar systemet består av och hur de hänger ihop |
| `02-databas.md` | Varje tabell, relationerna mellan dem, och hur behörigheterna fungerar |
| `03-floden.md` | Vad som faktiskt händer när en student registrerar sig, ett företag tar emot, ett avtal signeras |
| `04-konton-och-tjanster.md` | Vilka externa tjänster som används, till vad, och var inloggningarna finns |
| `05-fallgropar.md` | Buggarna som kostade mest tid och varför de uppstod. Läs denna innan du ändrar något |
| `06-vidareutveckling.md` | Vad som inte är byggt, vad som är halvfärdigt, och vad som planerats för version 2 |

`sql/` innehåller alla databasmigreringar i körordning, plus skriptet som
rensar testdata inför skarp drift.

---

## Om du är en AI som tar över

Läs `05-fallgropar.md` först, inte sist. Den innehåller mönster som kommer att
upprepas om du inte känner till dem — särskilt hur Row Level Security i
Supabase ger oändlig rekursion när en policy läser sin egen tabell, och varför
alla policyvillkor här går genom `SECURITY DEFINER`-funktioner.

Kodbasen är Next.js med App Router. Varje sida är en klientkomponent som
hämtar sin egen data från Supabase. Det finns ingen separat backend: det som
behöver servernyckel ligger som API-route under `app/api/`.

Projektet är byggt tillsammans med ägaren, som inte är utvecklare. Förklara
vad du gör och varför, inte bara vad som ska klistras in var.

---

## Om du är en byrå som ska ta över

Tre saker som är värda att veta innan du räknar på arbetet.

**Datamodellen är genomtänkt men ung.** Den har redan gått igenom tre
strukturella omskrivningar: flera utbildningar per utbildningsledare, skolor
som egen nivå, och LIA-behov som egna platser i stället för fält på
företagsraden. Varje omskrivning gjordes innan det fanns riktig data, vilket
var avsiktligt.

**Behörigheterna ligger i databasen, inte i koden.** Row Level Security styr
vem som ser vad. En ändring i gränssnittet som inte har stöd i en policy ger
tomma listor i stället för felmeddelanden, vilket är lätt att missförstå som
en bugg i frontend.

**Det finns ingen testsvit.** Inga enhetstester, inga e2e-tester. Testningen
har skett manuellt enligt ett protokoll. Om ni tar över kommersiellt är det
första investeringen jag skulle rekommendera.

---

## Vad som ska sparas, och var

| Vad | Var det finns | Hur det säkras |
| --- | --- | --- |
| Koden | GitHub, `berishamail-lgtm/lialink-` | Redan versionerad. Se till att du har tillgång till repot |
| Databasstrukturen | `sql/` i det här arkivet och i repot | Migreringarna är körbara i ordning på en tom Supabase-instans |
| Databasens innehåll | Supabase | Kräver egen säkerhetskopia. Gratisplanen har inga automatiska |
| Hemligheter | `.env.local` lokalt, och i Vercels inställningar | **Ska aldrig ligga i ett arkiv du skickar vidare.** Se `04-konton-och-tjanster.md` |
| Domänen lialink.se | Loopia | Se till att faktureringen är knuten till ett konto som inte försvinner |
| Dokumentationen | Det här arkivet | Uppdatera den när modellen ändras, annars är den värdelös om ett år |
