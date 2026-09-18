import Link from 'next/link'

export const metadata = {
  title: 'Integritetspolicy — LIAlink',
  description: 'Så behandlar LIAlink personuppgifter.',
}

export default function Integritetspolicy() {
  return (
    <main className="min-h-screen">
      <header className="border-b border-white/10">
        <div className="max-w-3xl mx-auto px-6 sm:px-10 h-16 flex items-center justify-between">
          <Link href="/" className="font-display font-extrabold text-xl text-white">
            LIA<span className="text-accent">link</span>
          </Link>
          <Link href="/" className="text-sm text-white/50 hover:text-white transition">
            Till startsidan
          </Link>
        </div>
      </header>

      <article className="max-w-3xl mx-auto px-6 sm:px-10 py-14 text-white/70 leading-relaxed">
        <h1 className="text-white text-3xl sm:text-4xl mb-3">Integritetspolicy</h1>
        <p className="text-white/40 text-sm mb-12">Senast uppdaterad 20 september 2026</p>

        <section className="mb-10">
          <h2 className="text-white text-xl mb-3">Om LIAlink</h2>
          <p className="mb-3">
            LIAlink kopplar samman studerande vid yrkeshögskoleutbildningar med
            företag som tar emot LIA, lärande i arbete. Plattformen tillhandahålls
            av Newlight AB, org.nr 559378-0074.
          </p>
          <p>
            Frågor om dataskydd: <a href="mailto:info@lialink.se" className="text-accent">info@lialink.se</a>
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-white text-xl mb-3">Vem ansvarar för dina uppgifter</h2>
          <p className="mb-3">
            Är du studerande är din utbildningsanordnare personuppgiftsansvarig.
            De avgör varför och hur dina uppgifter behandlas. Vi behandlar dem på
            deras uppdrag enligt ett skriftligt biträdesavtal. Frågor om dina
            uppgifter ställer du i första hand till din utbildningsledare.
          </p>
          <p className="mb-3">
            Är du företagsrepresentant eller handledare är Newlight AB
            personuppgiftsansvarig för de uppgifter du själv registrerar.
          </p>
          <p>
            Är du utbildningsledare ansvarar din arbetsgivare för uppgifter om de
            studerande, medan Newlight AB ansvarar för ditt användarkonto.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-white text-xl mb-3">Vilka uppgifter vi behandlar</h2>

          <h3 className="text-white/90 mb-2 mt-6">Om studerande</h3>
          <ul className="space-y-1 mb-4">
            <li>Namn, e-postadress och ort</li>
            <li>Utbildning, klass och skola</li>
            <li>Kompetenser och egen presentation</li>
            <li>CV och personligt brev, om du laddar upp dem</li>
            <li>LIA-period och status för din placering</li>
            <li>Meddelanden du skickar i plattformen</li>
            <li>Uppgifter i LIA-avtal: adress, telefonnummer, avtalsperiod</li>
            <li>Omdöme från handledare efter genomförd LIA</li>
            <li>Tidpunkt och IP-adress vid digital signering</li>
          </ul>
          <p className="mb-4 text-white/50 text-sm">
            Personnummer behandlas inte i plattformen. I avtalet som genereras
            lämnas fältet tomt och fylls i för hand vid signering.
          </p>

          <h3 className="text-white/90 mb-2 mt-6">Om företagsrepresentanter och handledare</h3>
          <ul className="space-y-1 mb-4">
            <li>Namn, e-postadress och telefonnummer</li>
            <li>Företagsuppgifter: namn, organisationsnummer, ort, bransch, beskrivning</li>
            <li>Meddelanden du skickar i plattformen</li>
            <li>Tidpunkt och IP-adress vid digital signering</li>
            <li>Svar i utvärderingsformulär efter genomförd LIA</li>
          </ul>

          <h3 className="text-white/90 mb-2 mt-6">Om utbildningsledare</h3>
          <ul className="space-y-1">
            <li>Namn, e-postadress och telefonnummer</li>
            <li>Uppgifter om utbildningen du ansvarar för</li>
          </ul>
        </section>

        <section className="mb-10">
          <h2 className="text-white text-xl mb-3">Varför vi behandlar uppgifterna</h2>
          <ul className="space-y-1">
            <li>Matcha studerande med företag som söker LIA-studenter</li>
            <li>Möjliggöra kontakt mellan parterna</li>
            <li>Upprätta och signera LIA-avtal</li>
            <li>Samla in handledarens utvärdering efter genomförd LIA</li>
            <li>Ta fram underlag för redovisning till Myndigheten för yrkeshögskolan</li>
            <li>Drift, säkerhet och support</li>
          </ul>
        </section>

        <section className="mb-10">
          <h2 className="text-white text-xl mb-3">Rättslig grund</h2>
          <p className="mb-3">
            För studerande vilar behandlingen på utbildningsanordnarens rättsliga
            grund, vanligen allmänt intresse eller avtal. Utbildningsanordnaren
            ansvarar för att grunden är korrekt.
          </p>
          <p>
            För företagsrepresentanter och handledare behandlar vi uppgifter för
            att fullgöra avtalet om användning av plattformen, samt för vårt
            berättigade intresse av att tillhandahålla tjänsten.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-white text-xl mb-3">Vem som kan se dina uppgifter</h2>
          <p className="mb-3">
            Plattformen begränsar åtkomst utifrån roll.
          </p>
          <p className="mb-3">
            <span className="text-white/90">Studerande</span> ser sin egen profil,
            sina matchningar, sina meddelanden och sina avtal.
          </p>
          <p className="mb-3">
            <span className="text-white/90">Företag</span> ser matchade studerandes
            profil, kompetenser och presentation. CV och personligt brev är åtkomliga
            endast för företag du matchats med. Företag ser inte studerande de inte
            matchats med.
          </p>
          <p className="mb-3">
            <span className="text-white/90">Utbildningsledare</span> ser studerande i
            sina egna klasser. De ser inte studerande vid andra utbildningar.
          </p>
          <p>
            <span className="text-white/90">Newlight AB</span> har teknisk åtkomst i
            den utsträckning som krävs för drift och support.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-white text-xl mb-3">Underbiträden</h2>
          <p className="mb-4">
            Vi anlitar följande leverantörer som behandlar uppgifter för vår räkning.
            Samtliga behandlar uppgifter inom EU och EES.
          </p>
          <div className="border border-white/10 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-white/40">
                  <th className="text-left px-4 py-3 font-medium">Leverantör</th>
                  <th className="text-left px-4 py-3 font-medium">Ändamål</th>
                  <th className="text-left px-4 py-3 font-medium">Placering</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['Supabase', 'Databas, inloggning, fillagring', 'Irland'],
                  ['Vercel', 'Drift av webbplatsen', 'EU'],
                  ['Resend', 'Utskick av e-post', 'Irland'],
                ].map(r => (
                  <tr key={r[0]} className="border-b border-white/5 last:border-0">
                    <td className="px-4 py-3 text-white/90">{r[0]}</td>
                    <td className="px-4 py-3">{r[1]}</td>
                    <td className="px-4 py-3">{r[2]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mb-10">
          <h2 className="text-white text-xl mb-3">Hur länge vi sparar uppgifterna</h2>
          <div className="border border-white/10 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-white/40">
                  <th className="text-left px-4 py-3 font-medium">Uppgift</th>
                  <th className="text-left px-4 py-3 font-medium">Lagringstid</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['Studerandes profil, CV och personligt brev', '12 månader efter avslutad utbildning'],
                  ['Meddelanden', '12 månader efter avslutad LIA-period'],
                  ['Signerade LIA-avtal', '3 år efter avslutad LIA-period'],
                  ['Handledarutvärderingar', '3 år efter avslutad LIA-period'],
                  ['Företagskonton', 'Till dess kontot tas bort'],
                ].map(r => (
                  <tr key={r[0]} className="border-b border-white/5 last:border-0">
                    <td className="px-4 py-3 text-white/90">{r[0]}</td>
                    <td className="px-4 py-3">{r[1]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mb-10">
          <h2 className="text-white text-xl mb-3">Dina rättigheter</h2>
          <p className="mb-3">Du har rätt att</p>
          <ul className="space-y-1 mb-4">
            <li>få veta vilka uppgifter vi behandlar om dig</li>
            <li>få felaktiga uppgifter rättade</li>
            <li>få uppgifter raderade</li>
            <li>invända mot eller begära begränsning av behandlingen</li>
            <li>få ut dina uppgifter i ett maskinläsbart format</li>
          </ul>
          <p className="mb-3">
            Är du studerande vänder du dig i första hand till din utbildningsanordnare.
          </p>
          <p className="mb-3">
            I plattformen kan du själv begära radering under Mitt konto. Har du
            signerade LIA-avtal kan dessa inte raderas, eftersom de är bindande
            handlingar mellan tre parter och utgör underlag för betyg och
            redovisning. I dessa fall tas dina personuppgifter bort och ersätts med
            en anonym markering, medan handlingen bevaras.
          </p>
          <p>
            Du har rätt att lämna klagomål till Integritetsskyddsmyndigheten.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-white text-xl mb-3">Säkerhet</h2>
          <p>
            All trafik till plattformen är krypterad. Åtkomst till uppgifter styrs
            på databasnivå utifrån användarens roll. Uppladdade filer är inte
            publikt åtkomliga utan hämtas via tidsbegränsade länkar. Lösenord
            lagras aldrig i klartext.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-white text-xl mb-3">Cookies</h2>
          <p>
            Plattformen använder endast de cookies som krävs för att hålla dig
            inloggad. Vi använder inte cookies för marknadsföring eller för att
            analysera ditt beteende.
          </p>
        </section>

        <section>
          <h2 className="text-white text-xl mb-3">Ändringar</h2>
          <p>
            Vid väsentliga ändringar informerar vi berörda användare via e-post
            eller i plattformen.
          </p>
        </section>
      </article>

      <footer className="border-t border-white/10">
        <div className="max-w-3xl mx-auto px-6 sm:px-10 py-8 flex flex-wrap gap-4 items-center justify-between text-sm text-white/30">
          <span className="font-display font-bold text-white/60">
            LIA<span className="text-accent">link</span>
          </span>
          <Link href="/anvandarvillkor" className="hover:text-white/60 transition">
            Användarvillkor
          </Link>
        </div>
      </footer>
    </main>
  )
}
