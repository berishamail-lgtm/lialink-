# Så här sparar du allt

Det här arkivet innehåller dokumentationen och databasmigreringarna. Det
innehåller **inte** koden och **inte** databasens innehåll. Den här filen
beskriver hur du får med de två sista delarna, och hur du förvarar alltihop
så att inget går förlorat.

---

## Vad som finns var

| Del | Var den lever | Går den förlorad om datorn kraschar? |
| --- | --- | --- |
| Koden | GitHub, `berishamail-lgtm/lialink-` | Nej, den ligger i molnet |
| Databasstrukturen | `sql/` här och i repot | Nej |
| Databasens innehåll | Supabase | **Ja, om du ligger kvar på gratisplanen** |
| Uppladdade CV och brev | Supabase Storage | **Ja, samma sak** |
| Hemligheterna | `.env.local` och Vercel | Delvis — Vercel har dem kvar |
| Domänen | Loopia | Nej, men den förfaller om fakturan inte betalas |
| Dokumentationen | Det här arkivet | **Ja, om du bara har den här** |

De två raderna i fetstil är de som faktiskt kan försvinna. Resten ligger
redan säkert.

---

## Steg 1 — Zippa koden

Kör i PowerShell. Kommandot hoppar över `node_modules`, `.next` och `.git`,
som tillsammans är hundratals megabyte och går att återskapa.

```powershell
cd $HOME
$datum = Get-Date -Format "yyyy-MM-dd"
$kalla = "$HOME\lialink"
$mal   = "$HOME\lialink-kod-$datum"

Copy-Item $kalla $mal -Recurse -Exclude @("node_modules", ".next", ".git")
Remove-Item "$mal\node_modules", "$mal\.next", "$mal\.git" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item "$mal\.env.local" -Force -ErrorAction SilentlyContinue

Compress-Archive -Path $mal -DestinationPath "$HOME\lialink-kod-$datum.zip" -Force
Remove-Item $mal -Recurse -Force

Get-ChildItem "$HOME\lialink-kod-$datum.zip" | Select-Object Name, Length
```

Lägg märke till raden som tar bort `.env.local`. **Den ska inte med i ett
arkiv du skickar till någon annan.** Den innehåller servernyckeln till
databasen, som går förbi alla behörighetsregler.

Behöver du ett arkiv för dig själv, till ditt eget valv, kan du låta filen
vara kvar — men då är zip-filen hemlig och ska behandlas som ett lösenord.

---

## Steg 2 — Säkerhetskopiera databasen

Hämta anslutningssträngen i Supabase under Project Settings, Database,
Connection string. Sedan:

```powershell
$datum = Get-Date -Format "yyyy-MM-dd"
pg_dump "<din connection string>" --no-owner --no-privileges -f "$HOME\lialink-databas-$datum.sql"
```

Saknar du `pg_dump` finns två alternativ. Har Supabase-projektet Pro-plan
finns automatiska säkerhetskopior under Database, Backups. Annars: öppna
Table Editor och exportera tabellerna som CSV med knappen Export. Det
återställer ingenting automatiskt, men du kan se vad som fanns.

Två dumpar är värda att ta separat:

```powershell
# Bara strukturen — den du behöver för att resa en ny miljö
pg_dump "<connection string>" --schema-only --no-owner -f "$HOME\lialink-schema-$datum.sql"
```

Strukturdumpen är den viktigaste av de två på lång sikt, eftersom
grundschemat saknas som migreringsfil i repot.

---

## Steg 3 — Hämta filerna ur Storage

CV och personliga brev ligger i hinken `dokument` i Supabase. De följer inte
med en databasdump.

Gå till Storage i Supabase, öppna hinken, markera och ladda ner. Finns det
många filer går det också via Supabase CLI.

Innan skarp drift är det här bara testfiler. Efteråt är det personuppgifter,
och då ska de inte ligga i en nedladdad mapp längre än nödvändigt.

---

## Steg 4 — Skriv ner hemligheterna på rätt ställe

Inte i det här arkivet, inte i ett mejl, inte i en textfil på skrivbordet.

Använd en lösenordshanterare. Spara:

- Inloggningen till GitHub, Vercel, Supabase, Resend och Loopia
- `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY`
- Anslutningssträngen till databasen

Märk upp varje post med vad den används till. Om någon annan ska ta över om
två år är det den informationen som saknas, inte nycklarna i sig.

---

## Steg 5 — Lägg allt på samma ställe

```
LIAlink-arkiv-2026-10-18/
├── lialink-overlamning/              ← det här arkivet, uppackat
│   ├── dokumentation/
│   ├── sql/
│   └── SA-HAR-SPARAR-DU-ALLT.md
├── lialink-kod-2026-10-18.zip        ← steg 1
├── lialink-databas-2026-10-18.sql    ← steg 2
├── lialink-schema-2026-10-18.sql     ← steg 2
└── storage-dokument/                 ← steg 3
```

Lägg mappen på två ställen som inte kan gå sönder samtidigt: en molntjänst
och en extern disk, eller två molntjänster hos olika leverantörer. En kopia
på samma dator som originalet är ingen kopia.

---

## Hur ofta

| Vad | Hur ofta |
| --- | --- |
| Koden | Behövs inte — varje push till GitHub är en kopia |
| Databasdump | Före varje migrering, och varje månad när plattformen är i drift |
| Dokumentationen | När datamodellen ändras. En dokumentation som ligger ett år efter koden är värre än ingen |
| Storage | När det finns riktiga filer, i samma takt som databasen |

---

## Om du lämnar över till en byrå

Skicka det här arkivet och ge dem läsrättigheter till GitHub-repot. Det
räcker för att de ska kunna bedöma arbetet och lämna en offert.

Hemligheterna lämnas **separat och först när avtalet är på plats**, via en
lösenordshanterare eller ett delat valv. Och när uppdraget är slut: rotera
nycklarna. En gammal servicenyckel fungerar tills någon byter den.

Innan du delar databasen eller en dump med någon utomstående: om den
innehåller riktiga personuppgifter behövs ett personuppgiftsbiträdesavtal
med byrån också, inte bara med skolan. Så länge allt är testdata spelar det
ingen roll, men gränsen går vid den första riktiga studenten.
