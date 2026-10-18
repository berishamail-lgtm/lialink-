# Konton och tjänster

## Varning innan du läser vidare

Det här dokumentet beskriver **vilka tjänster som används och till vad**. Det
innehåller inga lösenord, API-nycklar eller anslutningssträngar, och det ska
det aldrig göra.

Skickar du det här arkivet till en byrå: lämna hemligheterna separat, i en
lösenordshanterare eller en delad valvtjänst. Mejla dem aldrig. En
servicenyckel till Supabase går förbi alla behörighetsregler och ger full
tillgång till varje personuppgift i databasen.

---

## Tjänsterna

| Tjänst | Används till | Plan | Vem äger kontot |
| --- | --- | --- | --- |
| **GitHub** | Kodbasen, `berishamail-lgtm/lialink-` | | Burim |
| **Vercel** | Hosting, deploy vid push till `main`, cron-jobb | | Burim |
| **Supabase** | Databas, inloggningar, filer, realtid | Kontrollera om den uppgraderats från gratis | Burim |
| **Resend** | Transaktionsmejl från `noreply@lialink.se` | Gratis: 100 mejl per dygn | Burim |
| **Loopia** | Domänen lialink.se och all DNS | | Burim |
| **Anthropic** | Claude, som byggt plattformen tillsammans med ägaren | | Burim |

---

## Miljövariabler

Finns på två ställen: i `.env.local` på utvecklingsdatorn, och i Vercels
projektinställningar under Environment Variables. **De måste stämma överens.**

| Variabel | Vad den är | Får den synas i webbläsaren? |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Adressen till Supabase-projektet | Ja |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Publik nyckel, begränsad av RLS | Ja |
| `SUPABASE_SERVICE_ROLE_KEY` | Servernyckel, går förbi all RLS | **Nej, aldrig** |
| `RESEND_API_KEY` | Nyckel för mejlutskick | **Nej** |

Prefixet `NEXT_PUBLIC_` är inte kosmetiskt: Next.js bakar in de variablerna i
webbläsarkoden. En hemlighet som får det prefixet är läckt i samma sekund som
någon öppnar sidan.

---

## DNS hos Loopia

| Typ | Namn | Syfte |
| --- | --- | --- |
| A / CNAME | `@` och `www` | Pekar lialink.se mot Vercel |
| TXT | `_dmarc` | DMARC-policy för mejl |
| TXT | SPF | Tillåter Resend att skicka i domänens namn |
| CNAME | DKIM | Signerar utgående mejl |

Alla fyra mejlposterna ska vara gröna i Resends gränssnitt. Blir de röda
hamnar utskicken i skräpposten utan att något felmeddelande visas.

---

## Supabase-inställningar som inte syns i koden

**Authentication → Providers → Email.** "Confirm email" är **påslaget**. Det
är skälet till att kontoskapande via inbjudan måste gå genom en serverroute:
i det ögonblick kontot skapas finns ingen session, och klienten kan därför
inte skriva någonting.

**Authentication → URL Configuration.** Site URL pekar på
`https://lialink.se`. Det är dit bekräftelselänken skickar användaren.

**Authentication → Email Templates.** Mallarna är översatta till svenska.
Byter du Supabase-projekt måste de översättas igen.

**Project Settings → Auth → SMTP.** Konfigurerad mot Resend så att
inloggnings- och bekräftelsemejl kommer från `noreply@lialink.se` i stället
för Supabases egen avsändare.

**Storage → hinken `dokument`.** Här ligger CV och personliga brev. Filerna
nås med signerade länkar som gäller i 60 sekunder, inte med publika URL:er.

---

## Vercel

Deploy sker automatiskt vid varje push till `main`. Det finns ingen
staging-miljö: det som pushas går till lialink.se.

`vercel.json` innehåller cron-schemat:

```json
{ "crons": [ { "path": "/api/cron", "schedule": "0 7 * * *" } ] }
```

---

## Testkonton som funnits under utvecklingen

Alla är plusadresser till ägarens egen Gmail: `berisha.mail+f1@gmail.com`,
`+f2`, `+f3`, `+f4`, `+f5` för företag, och motsvarande för studenter och
handledare. Plus några konton skapade åt närstående under testningen.

**Alla ska bort innan skarp drift.** Skriptet `sql/rensning-testdata.sql`
gör det, och dokumentet "Rensning inför skarp drift" beskriver hela
proceduren.

---

## Om ägaren byts ut

Checklista för att flytta över allt till någon annan:

- [ ] GitHub: överför repot eller lägg till den nya ägaren som administratör
- [ ] Vercel: bjud in till projektet, eller flytta det till en organisation
- [ ] Supabase: bjud in till projektet som Owner
- [ ] Resend: lägg till användaren och kontrollera att domänen är kvar
- [ ] Loopia: domänen är knuten till ett personligt konto, den kräver en
      faktisk överlåtelse
- [ ] Rotera alla nycklar efteråt: ny service role key i Supabase, ny
      API-nyckel i Resend, och uppdatera dem i Vercel och `.env.local`
- [ ] Personuppgiftsansvaret: biträdesavtalet med skolan måste skrivas om om
      biträdet byts

Punkten om att rotera nycklar är den som glöms. En gammal servicenyckel som
någon har kvar i en gammal `.env.local` fungerar tills den byts.
