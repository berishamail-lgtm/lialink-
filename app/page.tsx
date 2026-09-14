import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-screen">
      <header className="border-b border-white/10">
        <div className="max-w-6xl mx-auto px-6 sm:px-10 h-16 flex items-center justify-between">
          <span className="font-display font-extrabold text-xl text-white">
            LIA<span className="text-accent">link</span>
          </span>
          <nav className="flex items-center gap-2">
            <Link href="/login" className="text-sm text-white/50 hover:text-white px-4 py-2 rounded-full transition">
              Logga in
            </Link>
            <Link href="/register" className="text-sm font-medium bg-white text-ink px-5 py-2 rounded-full hover:opacity-85 transition">
              Skapa konto
            </Link>
          </nav>
        </div>
      </header>

      <section className="max-w-6xl mx-auto px-6 sm:px-10 pt-20 pb-24">
        <h1 className="text-white text-4xl sm:text-6xl lg:text-7xl max-w-3xl">
          LIA-platser ska inte hänga på tur.
        </h1>
        <p className="text-white/50 text-base sm:text-lg max-w-xl mt-7 leading-relaxed">
          LIAlink samlar studenter, företag och utbildningsledare på samma
          plats. Studenten hittar sin plats, företaget hittar rätt person,
          och du ser var alla ligger till — i realtid.
        </p>
        <div className="flex flex-wrap gap-3 mt-10">
          <Link href="/register" className="bg-accent text-white font-display font-bold px-7 py-3.5 rounded-full hover:opacity-85 transition">
            Kom igång
          </Link>
          <Link href="#roller" className="border border-white/20 text-white/70 px-7 py-3.5 rounded-full hover:border-white/50 hover:text-white transition">
            Se hur det fungerar
          </Link>
        </div>
      </section>

      <section id="roller" className="max-w-6xl mx-auto px-6 sm:px-10 pb-24">
        <h2 className="text-white text-2xl sm:text-3xl mb-3">
          Tre roller, ett system
        </h2>
        <p className="text-white/40 max-w-lg mb-10 leading-relaxed">
          Alla ser samma LIA-process, men bara sin egen del av den.
        </p>

        <div className="grid gap-4 md:grid-cols-3">
          <article className="bg-surface border border-white/10 rounded-3xl p-7">
            <h3 className="text-white text-lg mb-3">Student</h3>
            <p className="text-white/45 text-sm leading-relaxed mb-6">
              Fyll i din profil en gång. Du får förslag på företag som
              matchar din utbildning, din stad och din LIA-period, och
              kan skriva direkt till dem.
            </p>
            <Link href="/register" className="text-sm text-white/70 hover:text-white underline underline-offset-4 decoration-white/20 hover:decoration-white transition">
              Skapa studentprofil
            </Link>
          </article>

          <article className="bg-surface border border-white/10 rounded-3xl p-7">
            <h3 className="text-white text-lg mb-3">Företag</h3>
            <p className="text-white/45 text-sm leading-relaxed mb-6">
              Registrera er en gång och beskriv vad ni söker. Ni får
              kandidater som redan passar er, och signerar LIA-avtalet
              digitalt när ni hittat rätt.
            </p>
            <Link href="/register" className="text-sm text-white/70 hover:text-white underline underline-offset-4 decoration-white/20 hover:decoration-white transition">
              Registrera företag
            </Link>
          </article>

          <article className="bg-surface border border-white/10 rounded-3xl p-7">
            <h3 className="text-white text-lg mb-3">Utbildningsledare</h3>
            <p className="text-white/45 text-sm leading-relaxed mb-6">
              Se varje students status på en skärm. Skapa avtal, följ
              signeringarna och exportera underlaget till MYH när
              perioden är slut.
            </p>
            <Link href="/register" className="text-sm text-white/70 hover:text-white underline underline-offset-4 decoration-white/20 hover:decoration-white transition">
              Anslut din utbildning
            </Link>
          </article>
        </div>
      </section>

      <footer className="border-t border-white/10">
        <div className="max-w-6xl mx-auto px-6 sm:px-10 py-8 flex flex-wrap gap-4 items-center justify-between text-sm text-white/30">
          <span className="font-display font-bold text-white/60">
            LIA<span className="text-accent">link</span>
          </span>
          <span>Pilotversion</span>
        </div>
      </footer>
    </main>
  )
}