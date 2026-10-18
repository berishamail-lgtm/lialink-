# Fallgropar

Buggarna som kostade mest tid under bygget, och varför de uppstod. Läs den
här innan du ändrar något. Flera av dem kommer tillbaka om man inte känner
till mönstret.

---

## 1. Oändlig rekursion i Row Level Security

**Symptom:** 500-fel från Supabase på en fråga som ser helt vanlig ut. Ibland
bara för vissa roller.

**Orsak:** en policy som läser sin egen tabell, eller två policyer som läser
varandras. Policyn på `company_members` läste `companies`, vars policy läste
`company_members`, och Postgres gav upp.

**Lösning:** alla policyvillkor går genom `SECURITY DEFINER`-funktioner, som
kör med ägarens rättigheter och därför inte utlöser policyn på nytt.

```sql
create or replace function mina_foretag()
returns setof uuid
language sql security definer stable
set search_path = public
as $$
  select id from companies where user_id = auth.uid()
  union
  select company_id from company_members where user_id = auth.uid()
$$;
```

Och i policyn: `using (company_id in (select mina_foretag()))`, aldrig
`using (company_id in (select id from companies where ...))`.

`set search_path = public` är obligatoriskt. Utan den kan funktionen luras
att läsa ur fel schema.

---

## 2. Tokensidor som blockeras av RLS

**Symptom:** "Länken stämmer inte" på en sida man kommit till via en länk i
ett mejl, trots att raden finns i databasen.

**Orsak:** sidan har ingen inloggad användare. Policyn kräver `auth.uid()`,
som är null.

**Lösning:** `for select using (true)` på de tabeller tokensidor läser —
`company_invites`, `member_invites`, `evaluations`, `intressesvar`. Token är
långt och slumpmässigt, och det är token som är säkerheten.

---

## 3. Kontoskapande utan session

**Symptom:** kontot skapas, men kopplingen till företaget sker aldrig. Ibland
tyst, ibland som ett främmande nyckel-fel på `profiles`.

**Orsak:** "Confirm email" är påslaget i Supabase. Efter `signUp` finns inget
bekräftat konto och därmed ingen session, så `auth.uid()` är null och
klienten kan inte skriva någonting.

**Lösning:** allt som ska skrivas i det ögonblicket görs av en API-route med
servernyckeln — `api/koppla-foretag` och `api/koppla-handledare`. Routen
skapar profilraden själv, eftersom den normalt skapas av klienten efter
inloggning.

**Mönstret att komma ihåg:** varje gång ett nytt konto ska kopplas till
någonting i samma andetag, måste det ske på servern.

---

## 4. Överlappande ALL-policyer blockerar insert

**Symptom:** går att läsa, går inte att skapa. Inget tydligt felmeddelande.

**Orsak:** en policy med `for all` och tom `with check` nekar alla insert,
även om en annan policy skulle tillåta dem.

**Lösning:** en policy per operation — `select`, `insert`, `update`, `delete`
— i stället för en `for all`. En `update`-policy behöver både `using` och
`with check`.

---

## 5. Teckenkodning: å ä ö blir Ã¥ Ã¤ Ã¶

**Symptom:** svenska tecken ser trasiga ut på sidan. I värsta fall går det
inte att spara en profil alls.

**Orsak:** `Set-Content -Encoding UTF8` i PowerShell skriver en BOM och fel
kodning.

**Det värsta fallet:** `status: 'sÃ¶ker'` i studentprofilen bröt mot ett
CHECK-villkor i databasen, så sparandet misslyckades. Felet såg ut som ett
behörighetsproblem och felsöktes åt fel håll i flera omgångar.

**Lösning vid filskrivning från PowerShell:**

```powershell
[System.IO.File]::WriteAllText($f, $t, (New-Object System.Text.UTF8Encoding $false))
```

**Leta efter det** med `Select-String -Pattern "Ã"` över kodbasen om något
beter sig konstigt.

---

## 6. Sidan fastnar på "Laddar"

**Symptom:** dashboarden laddar i evighet, eller visar ett tomt skal för en
utloggad användare.

**Orsak:** `supabase.auth.getUser()` anropades innan sessionen hunnit
återställas från webbläsarens lagring. Den returnerade null, och koden
drog slutsatsen att ingen var inloggad.

**Lösning:** `getSession()` plus en prenumeration på `onAuthStateChange`, och
en timeout som släpper laddningsläget efter några sekunder så att sidan inte
kan hänga sig för alltid.

```typescript
supabase.auth.getSession().then(({ data: { session } }) => { ... })
const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => { ... })
const timeout = setTimeout(() => setLoading(false), 8000)
```

---

## 7. `useSearchParams()` kraschar bygget

**Symptom:** bygget går igenom lokalt men felar på Vercel med ett krav på
Suspense.

**Lösning:** läs frågesträngen direkt i stället.

```typescript
const värde = typeof window !== 'undefined'
  ? new URLSearchParams(window.location.search).get('placering')
  : null
```

---

## 8. TypeScript smalnar av en join till `never`

**Symptom:** `Property 'company_name' does not exist on type 'never'`.

**Orsak:** Supabase-klienten vet inte om en inbäddad relation är ett objekt
eller en lista, och TypeScript resonerar bort den ena grenen.

**Lösning:** plocka ut värdet i en egen variabel med explicit `any` före
returen, i stället för att göra `Array.isArray(...) ? ... : ...` inline.

```typescript
const co: any = Array.isArray(rad.companies) ? rad.companies[0] : rad.companies
// sedan: co?.company_name
```

---

## 9. Kolumnnamn som inte finns

Flera buggar har berott på att koden refererat en kolumn som inte existerar.
Supabase svarar då inte alltid med ett tydligt fel — ibland blir resultatet
bara null, och felet dyker upp som "hittades inte" längre fram.

Exempel som faktiskt hänt: `companies.name` finns inte, den heter
`company_name`. `companies.available_from` och `available_to` finns inte, de
heter `lia_period_start` och `lia_period_end` — det senare gjorde att
matchningens periodpoäng var noll i veckor utan att någon märkte det.

**Kontrollera alltid mot databasen i stället för att gissa:**

```sql
select column_name, data_type, is_nullable
from information_schema.columns
where table_name = 'companies'
order by ordinal_position;
```

---

## 10. Kaskader vid radering

`companies.user_id` pekar på `profiles` med `on delete cascade`. Raderar du
en profil försvinner personens företag med allt vad det innebär.

Samma mönster finns på flera ställen. Innan du raderar något, titta på vad
som hänger i det:

```sql
select conname, pg_get_constraintdef(oid)
from pg_constraint
where confrelid = 'profiles'::regclass;
```

---

## 11. Editorn skriver över ändringar

**Symptom:** en rättning som gjorts försvinner. Bygget felar på exakt samma
rad som nyss lagades, och `git status` visar inte filen som ändrad.

**Orsak:** VS Code hade filen öppen med gammalt innehåll i bufferten och
sparade tillbaka sin version över den nya.

**Lösning:** stäng filer i editorn medan någon annan skriver dem, och kör
alltid `git status --short` före `git commit`. Listar den inte de filer som
nyss ändrats har något skrivit över dem.

Det här är inget fel i koden, men det kostade tre deployer och en bra stund
innan det identifierades.

---

## 12. Tomma filer efter nedladdning

**Symptom:** bygget felar på en fil som ser korrekt ut.

**Orsak:** filen var noll byte efter en `Move-Item` från nedladdningsmappen.

**Lösning:** kontrollera storleken efter varje flytt.

```powershell
Get-ChildItem "app\sokvag\page.tsx" | Select-Object Length
```

---

## 13. Resends dygnsgräns

Gratisplanen tillåter 100 mejl per dygn. Matchningsrouten har ett eget tak på
80 per körning som marginal. Kommer inget mejl fram: kontrollera kvoten i
Resend innan du letar i koden.

Ett mejl som studsar — felstavad adress — syns som `bounced` i Resends logg,
inte som ett fel i applikationen.
