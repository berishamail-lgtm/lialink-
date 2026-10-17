'use client'
import { useEffect, useState } from 'react'
import { createClient } from '../../lib/supabase'
import { useRouter } from 'next/navigation'
import Sidebar from '../../components/Sidebar'
import { useEdu } from '../../components/EduContext'

type Rad = {
  studentId: string
  userId: string | null
  namn: string
  epost: string | null
  ort: string | null
  klass: string
  harKompetenser: boolean
  harBio: boolean
  harOrt: boolean
  harCv: boolean
  harPb: boolean
  profilProcent: number
  matchTotalt: number
  matchBra: number
  toppPoang: number | null
  toppForetag: string | null
  kontaktade: number
  svar: number
  sistKontakt: string | null
  senastAktiv: string | null
  placeringStatus: string | null
  periodNamn: string | null
}

const KLAR = ['avtal', 'aktiv', 'klar']

export default function Aktivitet() {
  const [profile, setProfile] = useState<any>(null)
  const [rader, setRader]     = useState<Rad[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter]   = useState('alla')

  const [puffFor, setPuffFor]   = useState<string | null>(null)
  const [puffText, setPuffText] = useState('')
  const [busy, setBusy]         = useState(false)
  const [klart, setKlart]       = useState('')
  const [error, setError]       = useState('')

  const supabase = createClient()
  const router   = useRouter()
  const { current } = useEdu()

  useEffect(() => {
    if (!current?.id) return
    load()
  }, [current?.id])

  async function load() {
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
    if (!user) { router.push('/login'); return }

    const { data: prof } = await supabase
      .from('profiles').select('*').eq('id', user.id).maybeSingle()
    setProfile(prof)

    const res = await fetch('/api/student-aktivitet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ educationId: current?.id }),
    })
    const data = await res.json()

    if (!res.ok) { setError(data.error || 'Kunde inte hämta aktiviteten'); setLoading(false); return }

    setRader(data.studenter || [])
    setLoading(false)
  }

  function lage(r: Rad) {
    if (r.placeringStatus && KLAR.includes(r.placeringStatus)) return 'klar'
    if (r.profilProcent < 60) return 'profil'
    if (r.matchBra > 0 && r.kontaktade === 0) return 'puff'
    if (r.kontaktade > 0 && r.svar === 0) return 'vantar'
    if (r.kontaktade > 0) return 'igang'
    return 'tyst'
  }

  const lageText: Record<string, string> = {
    klar:   'Har plats',
    profil: 'Ofullständig profil',
    puff:   'Behöver puff',
    vantar: 'Väntar på svar',
    igang:  'I dialog',
    tyst:   'Inga matchningar än',
  }
  const lageStil: Record<string, string> = {
    klar:   'bg-ok/10 text-ok',
    profil: 'bg-warn/10 text-warn',
    puff:   'bg-alert/10 text-alert',
    vantar: 'bg-text/8 text-muted',
    igang:  'bg-accent/10 text-accent',
    tyst:   'bg-text/8 text-muted',
  }

  const ordning: Record<string, number> = {
    puff: 0, profil: 1, vantar: 2, tyst: 3, igang: 4, klar: 5,
  }

  const sorterade = [...rader].sort((a, b) => {
    const la = ordning[lage(a)] ?? 9
    const lb = ordning[lage(b)] ?? 9
    return la - lb || a.namn.localeCompare(b.namn, 'sv')
  })

  const synliga = sorterade.filter(r => {
    if (filter === 'alla') return true
    if (filter === 'atgard') return ['puff', 'profil'].includes(lage(r))
    if (filter === 'utanplats') return !(r.placeringStatus && KLAR.includes(r.placeringStatus))
    return true
  })

  const antalPuff   = rader.filter(r => lage(r) === 'puff').length
  const antalPlats  = rader.filter(r => r.placeringStatus && KLAR.includes(r.placeringStatus)).length
  const antalAktiva = rader.filter(r => r.kontaktade > 0).length

  function dagarSedan(iso: string | null) {
    if (!iso) return null
    const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
    if (d <= 0) return 'i dag'
    if (d === 1) return 'i går'
    if (d < 30) return d + ' dagar sedan'
    const m = Math.floor(d / 30)
    return m === 1 ? 'en månad sedan' : m + ' månader sedan'
  }

  async function puffa(r: Rad) {
    setBusy(true); setError(''); setKlart('')

    const res = await fetch('/api/puffa-student', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studentId:   r.studentId,
        educationId: current?.id,
        meddelande:  puffText,
      }),
    })
    const data = await res.json()
    setBusy(false)

    if (!res.ok) { setError(data.error || 'Påminnelsen kunde inte skickas'); return }

    setKlart('Påminnelse skickad till ' + r.namn)
    setPuffFor(null)
    setPuffText('')
  }

  if (loading) return (
    <div className="min-h-screen bg-paper flex items-center justify-center">
      <p className="text-muted text-sm">Laddar</p>
    </div>
  )

  const filterKnappar = [
    { v: 'alla',      t: 'Alla' },
    { v: 'atgard',    t: 'Behöver åtgärd' },
    { v: 'utanplats', t: 'Utan plats' },
  ]

  return (
    <div className="min-h-screen bg-paper text-text flex flex-col lg:flex-row">
      <Sidebar role="education" name={profile?.full_name} subtitle={(current as any)?.program_name} />

      <main className="flex-1 p-5 sm:p-8 max-w-4xl">
        <h1 className="text-2xl sm:text-3xl mb-1">Studentaktivitet</h1>
        <p className="text-muted text-sm mb-7">
          Den som har matchningar men inte skrivit till någon är den du ska ringa.
          Företagen hör sällan av sig först.
        </p>

        {error && (
          <p className="bg-alert/10 border border-alert/25 text-alert text-sm rounded-lg px-4 py-3 mb-5">{error}</p>
        )}
        {klart && (
          <p className="bg-ok/10 border border-ok/25 text-ok text-sm rounded-lg px-4 py-3 mb-5">{klart}</p>
        )}

        {rader.length === 0 ? (
          <div className="bg-card border border-line rounded-xl p-10 text-center">
            <p className="mb-1">Inga studenter i den här utbildningen</p>
            <p className="text-muted text-sm">
              Lägg till studenter under Studenter, så dyker de upp här.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              {[
                { n: rader.length,  label: 'studenter' },
                { n: antalPuff,     label: 'behöver puff', varning: antalPuff > 0 },
                { n: antalAktiva,   label: 'har kontaktat företag' },
                { n: antalPlats,    label: 'har plats' },
              ].map((s, i) => (
                <div key={i} className="bg-card border border-line rounded-xl p-4">
                  <p className={`font-display text-2xl font-extrabold ${s.varning ? 'text-alert' : ''}`}>
                    {s.n}
                  </p>
                  <p className="text-muted text-xs mt-1 leading-snug">{s.label}</p>
                </div>
              ))}
            </div>

            <div className="flex gap-1.5 flex-wrap mb-5">
              {filterKnappar.map(f => (
                <button
                  key={f.v}
                  onClick={() => setFilter(f.v)}
                  className={`px-3.5 py-2 rounded-full text-sm transition ${
                    filter === f.v
                      ? 'bg-text text-paper'
                      : 'border border-line text-muted hover:border-text/30'
                  }`}
                >
                  {f.t}
                </button>
              ))}
            </div>

            <div className="space-y-3">
              {synliga.map(r => {
                const l = lage(r)
                const saknas = [
                  !r.harKompetenser && 'kompetenser',
                  !r.harOrt && 'ort',
                  !r.harBio && 'presentation',
                  !r.harCv && 'CV',
                  !r.harPb && 'personligt brev',
                ].filter(Boolean) as string[]

                return (
                  <article key={r.studentId} className="bg-card border border-line rounded-xl overflow-hidden">
                    <div className="p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                        <div className="min-w-0">
                          <h2 className="text-base">{r.namn}</h2>
                          <p className="text-muted text-sm mt-0.5">
                            {[r.klass, r.ort, r.periodNamn].filter(Boolean).join(' · ')}
                          </p>
                        </div>
                        <span className={'px-2.5 py-1 rounded-full text-xs font-medium shrink-0 ' + lageStil[l]}>
                          {lageText[l]}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3 mb-4">
                        <div>
                          <p className="font-display text-lg font-extrabold tabular-nums">
                            {r.profilProcent}%
                          </p>
                          <p className="text-muted text-xs">profil ifylld</p>
                        </div>
                        <div>
                          <p className="font-display text-lg font-extrabold tabular-nums">
                            {r.matchBra}
                            {r.matchTotalt > r.matchBra && (
                              <span className="text-muted font-normal text-sm"> av {r.matchTotalt}</span>
                            )}
                          </p>
                          <p className="text-muted text-xs">matchningar över 60</p>
                        </div>
                        <div>
                          <p className={`font-display text-lg font-extrabold tabular-nums ${
                            r.kontaktade === 0 && r.matchBra > 0 ? 'text-alert' : ''
                          }`}>
                            {r.kontaktade}
                          </p>
                          <p className="text-muted text-xs">företag kontaktade</p>
                        </div>
                        <div>
                          <p className="font-display text-lg font-extrabold tabular-nums">{r.svar}</p>
                          <p className="text-muted text-xs">har svarat</p>
                        </div>
                      </div>

                      {saknas.length > 0 && (
                        <p className="text-muted text-sm mb-3">
                          Saknas i profilen: {saknas.join(', ')}.
                        </p>
                      )}

                      {r.toppForetag && (
                        <p className="text-muted text-sm mb-3">
                          Bästa matchning: {r.toppForetag}, {r.toppPoang}%.
                        </p>
                      )}

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-muted text-xs mb-4">
                        <span>
                          Senast inloggad: {dagarSedan(r.senastAktiv) || 'aldrig'}
                        </span>
                        {r.sistKontakt && (
                          <span>Skrev senast till ett företag {dagarSedan(r.sistKontakt)}</span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-4">
                        {l !== 'klar' && (
                          <button
                            onClick={() => {
                              setPuffFor(puffFor === r.studentId ? null : r.studentId)
                              setPuffText(''); setError(''); setKlart('')
                            }}
                            className={`rounded-full px-5 py-2 text-sm font-medium transition ${
                              l === 'puff'
                                ? 'bg-accent text-white hover:opacity-85'
                                : 'border border-line text-muted hover:border-text/30'
                            }`}
                          >
                            {puffFor === r.studentId ? 'Avbryt' : 'Skicka påminnelse'}
                          </button>
                        )}
                        {r.userId && (
                          <button
                            onClick={() => router.push('/dashboard/messages?to=' + r.userId + '&name=' + encodeURIComponent(r.namn))}
                            className="text-muted hover:text-text text-sm underline underline-offset-4 decoration-line transition"
                          >
                            Skriv direkt
                          </button>
                        )}
                      </div>
                    </div>

                    {puffFor === r.studentId && (
                      <div className="border-t border-line bg-paper/50 p-5 space-y-3">
                        <p className="text-sm font-medium">Påminnelse till {r.namn}</p>
                        <p className="text-muted text-sm">
                          Mejlet listar hennes bästa matchningar och länkar in i LIAlink.
                          Svar går till din adress. Lämnar du rutan tom används
                          standardtexten.
                        </p>
                        <textarea
                          value={puffText}
                          onChange={e => setPuffText(e.target.value)}
                          rows={3}
                          placeholder="Egen text, om du vill säga något särskilt."
                          className="w-full bg-card border border-line rounded-lg px-4 py-2.5 text-sm outline-none focus:border-text/40 transition resize-y"
                        />
                        <button
                          onClick={() => puffa(r)}
                          disabled={busy}
                          className="bg-text text-paper rounded-full px-5 py-2 text-sm font-medium hover:opacity-85 transition disabled:opacity-40"
                        >
                          {busy ? 'Skickar' : 'Skicka'}
                        </button>
                      </div>
                    )}
                  </article>
                )
              })}
            </div>

            <p className="text-muted text-xs mt-5 leading-relaxed">
              Kontakter räknas som antal olika företag studenten skrivit till i
              LIAlink. Kontakt som tagits per telefon eller utanför plattformen syns
              inte här, så fråga innan du drar slutsatser av en nolla.
            </p>
          </>
        )}
      </main>
    </div>
  )
}
