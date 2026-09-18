import Link from 'next/link'

export const metadata = {
  title: 'Användarvillkor — LIAlink',
  description: 'Villkor för att använda LIAlink.',
}

export default function Anvandarvillkor() {
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
        <h1 className="text-white text-3xl sm:text-4xl mb-3">Användarvillkor</h1>
        <p className="text-white/40 text-sm mb-12">Senast uppdaterad 20 september 2026</p>

        <section className="mb-10">
          <h2 className="text-white text-xl mb-3">Om tjänsten</h2>
          <p className="mb-3">
            LIAlink kopplar samman studerande vid yrkeshögskoleutbildningar med
            företag som tar emot LIA, lärande i arbete. Tjänsten tillhandahålls av
            Newlight AB, org.nr 559378-0074.
          </p>
          <p>
            Genom att skapa ett konto godkänner du dessa villkor.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-white text-xl mb-3">Vem som får använda tjänsten</h2>
          <p className="mb-3">Tjänsten riktar sig till</p>
          <ul className="space-y-1 mb-4">
            <li>studerande vid utbildningar som är anslutna till plattformen</li>
            <li>företag och organisationer som tar emot LIA-studerande</li>
            <li>utbildningsledare och personal hos anslutna utbildningsanordnare</li>
          </ul>
          <p className="mb-3">
            Du måste vara 18 år eller ha målsmans godkännande för att skapa konto.
          </p>
          <p>
            Studerande ansluter sig till sin utbildning med en kod från
            utbildningsanordnaren. Konton utan giltig koppling till en utbildning
            ger inte tillgång till matchning.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-white text-xl mb-3">Ditt konto</h2>
          <p className="mb-3">Du ansvarar för att</p>
          <ul className="space-y-1 mb-4">
            <li>uppgifterna du lämnar är korrekta</li>
            <li>ditt lösenord hålls hemligt</li>
            <li>omgående meddela oss om du misstänker att någon annan använt ditt konto</li>
          </ul>
          <p>Ett konto är personligt och får inte delas.</p>
        </section>

        <section className="mb-10">
          <h2 className="text-white text-xl mb-3">Så använder du tjänsten</h2>
          <p className="mb-3">Du får inte</p>
          <ul className="space-y-1 mb-4">
            <li>lämna felaktiga uppgifter om dig själv, din utbildning eller ditt företag</li>
            <li>använda tjänsten för att kontakta användare i annat syfte än LIA</li>
            <li>ladda upp innehåll som är olagligt, kränkande eller strider mot annans rätt</li>
            <li>försöka nå uppgifter du inte har behörighet till</li>
            <li>använda automatiserade metoder för att samla in uppgifter från plattformen</li>
            <li>belasta tjänsten på ett sätt som stör driften</li>
          </ul>
          <p>Vi får stänga av konton som bryter mot dessa villkor.</p>
        </section>

        <section className="mb-10">
          <h2 className="text-white text-xl mb-3">Innehåll du laddar upp</h2>
          <p className="mb-3">
            Du behåller rätten till innehåll du laddar upp, som CV och personligt brev.
          </p>
          <p className="mb-3">
            Du ger oss rätt att lagra och visa innehållet för de användare som enligt
            plattformens regler ska ha åtkomst till det, i syfte att tillhandahålla
            tjänsten.
          </p>
          <p>
            Du ansvarar för att du har rätt att dela det innehåll du laddar upp.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-white text-xl mb-3">LIA-avtal och signering</h2>
          <p className="mb-3">
            Plattformen tillhandahåller ett verktyg för att upprätta och signera
            LIA-avtal digitalt.
          </p>
          <p className="mb-3">
            Avtalet ingås mellan studerande, mottagande företag och
            utbildningsanordnare. Newlight AB är inte part i avtalet och ansvarar
            inte för dess innehåll, giltighet eller efterlevnad.
          </p>
          <p className="mb-3">
            Signeringen sker genom bekräftelse i plattformen och registreras med
            tidpunkt och IP-adress. Den utgör inte avancerad elektronisk underskrift
            enligt eIDAS-förordningen.
          </p>
          <p>
            Utbildningsanordnaren ansvarar för att avtalets innehåll uppfyller
            gällande krav.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-white text-xl mb-3">Matchning</h2>
          <p className="mb-3">
            Plattformen föreslår matchningar baserat på ort, kompetenser, tidsperiod
            och bransch.
          </p>
          <p>
            Ett matchningsförslag innebär ingen garanti för LIA-plats och medför inga
            förpliktelser för någon part. Beslut om placering fattas av parterna
            själva.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-white text-xl mb-3">Tillgänglighet</h2>
          <p>
            Vi strävar efter att tjänsten ska vara tillgänglig men lämnar ingen
            garanti om oavbruten drift. Planerade avbrott för underhåll aviseras i
            förväg när det är möjligt.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-white text-xl mb-3">Avgifter</h2>
          <p>
            Under pilotfasen är tjänsten kostnadsfri för anslutna utbildningar och
            företag. Villkor för framtida avgifter meddelas i god tid innan de
            träder i kraft.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-white text-xl mb-3">Uppsägning</h2>
          <p className="mb-3">
            Du kan när som helst ta bort ditt konto under Mitt konto i plattformen.
          </p>
          <p className="mb-3">
            Har du signerade LIA-avtal kan dessa inte raderas, eftersom de är
            bindande handlingar mellan tre parter. Dina personuppgifter tas då bort
            och ersätts med en anonym markering, medan handlingen bevaras. Detta
            beskrivs närmare i vår{' '}
            <Link href="/integritetspolicy" className="text-accent">integritetspolicy</Link>.
          </p>
          <p>
            Vi får avsluta ett konto vid väsentligt brott mot dessa villkor, efter
            skriftlig varning där det är rimligt.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-white text-xl mb-3">Ansvarsbegränsning</h2>
          <p className="mb-3">Tjänsten tillhandahålls i befintligt skick.</p>
          <p className="mb-3">Newlight AB ansvarar inte för</p>
          <ul className="space-y-1 mb-4">
            <li>innehåll som användare lägger in i plattformen</li>
            <li>att en studerande får en LIA-plats</li>
            <li>hur en LIA-period genomförs eller vad som sker på arbetsplatsen</li>
            <li>indirekt skada, utebliven vinst eller följdskada</li>
          </ul>
          <p className="mb-3">
            Newlight AB:s sammanlagda ansvar är begränsat till vad som följer av
            tvingande lag.
          </p>
          <p>
            Begränsningen gäller inte vid uppsåt eller grov vårdslöshet.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-white text-xl mb-3">Personuppgifter</h2>
          <p>
            Behandling av personuppgifter beskrivs i vår{' '}
            <Link href="/integritetspolicy" className="text-accent">integritetspolicy</Link>.
            För studerande är utbildningsanordnaren personuppgiftsansvarig och
            Newlight AB personuppgiftsbiträde enligt separat avtal.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-white text-xl mb-3">Ändringar av villkoren</h2>
          <p>
            Vi kan ändra dessa villkor. Vid väsentliga ändringar informerar vi dig
            via e-post eller i plattformen minst 30 dagar innan ändringen träder i
            kraft. Fortsatt användning innebär att du godkänner de nya villkoren.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-white text-xl mb-3">Tillämplig lag och tvist</h2>
          <p>
            Svensk lag tillämpas. Tvist avgörs av allmän domstol. Är du konsument kan
            du även vända dig till Allmänna reklamationsnämnden.
          </p>
        </section>

        <section>
          <h2 className="text-white text-xl mb-3">Kontakt</h2>
          <p>
            Frågor om dessa villkor:{' '}
            <a href="mailto:info@lialink.se" className="text-accent">info@lialink.se</a>
          </p>
        </section>
      </article>

      <footer className="border-t border-white/10">
        <div className="max-w-3xl mx-auto px-6 sm:px-10 py-8 flex flex-wrap gap-4 items-center justify-between text-sm text-white/30">
          <span className="font-display font-bold text-white/60">
            LIA<span className="text-accent">link</span>
          </span>
          <Link href="/integritetspolicy" className="hover:text-white/60 transition">
            Integritetspolicy
          </Link>
        </div>
      </footer>
    </main>
  )
}
