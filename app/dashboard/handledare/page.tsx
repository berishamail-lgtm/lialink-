'use client'
import { useEffect, useState } from 'react'
import { createClient } from '../../lib/supabase'
import { useRouter } from 'next/navigation'
import Sidebar from '../../components/Sidebar'
import { useEdu } from '../../components/EduContext'

type Rad = {
  id: string
  name: string
  email: string | null
  phone: string | null
  roll: string | null
  aktiv: boolean
  harKonto: boolean
  foretag: string
  ort: string | null
  companyId: string
  mottagna: number
  pagaende: number
  senast: string | null
  utbildningar: string[]
  oppnaPlatser: number
}

export default function ULHandledare() {
  const [profile, setProfile] = useState<any>(null)
  const [rader, setRader]     = useState<Rad[]>([])
  const [loading, setLoading] = useState(true)
  const [sok, setSok]         = useState('')
  const [filter, setFilter]   = useState('alla')

  const supabase = createClient()
  const router   = useRouter()
  const { current } = useEdu()

  useEffect(() => { load() }, [])

  async function load() {
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
    if (!user) { router.push('/login'); return }

    const { data: prof } = await supabase
      .from('profiles').select('*').eq('id', user.id).maybeSingle()
    setProfile(prof)

    // RLS släpper bara igenom handledare hos företag i skolans nätverk,
    // eller hos företag som redan har en placering hos oss.
    const { data: h } = await supabase
      .from('handledare')
      .select('id, name, email, phone, roll, aktiv, user_id, company_id, companies(company_name, city)')
      .order('name')

    const handledare = h || []
    const ids = handledare.map((x: any) => x.id)

    const stat: Record<string, {
      mottagna: number
      pagaende: number
      senast: string | null
      utb: Set<string>
    }> = {}

    if (ids.length) {
      const { data: pl } = await supabase
        .from('placements')
        .select(`
          handledare_id, status, actual_start, actual_end,
          lia_periods(start_date, end_date, classes(educations(program_name)))
        `)
        .in('handledare_id', ids)

      for (const p of pl || []) {
        const hid = (p as any).handledare_id
        if (!hid) continue
        if (!stat[hid]) stat[hid] = { mottagna: 0, pagaende: 0, senast: null, utb: new Set() }

        const s = stat[hid]
        if (['avtal', 'aktiv', 'klar'].includes(p.status)) s.mottagna++
        if (p.status === 'aktiv') s.pagaende++

        const slut = (p as any).actual_end || (p as any).lia_periods?.end_date
        if (slut && (!s.senast || slut > s.senast)) s.senast = slut

        const program = (p as any).lia_periods?.classes?.educations?.program_name
        if (program) s.utb.add(program)
      }
    }

    const platsAntal: Record<string, number> = {}
    if (ids.length) {
      const { data: lp } = await supabase
        .from('lia_platser')
        .select('handledare_id, status')
        .in('handledare_id', ids)

      for (const p of lp || []) {
        if (p.status === 'oppen' && p.handledare_id) {
          platsAntal[p.handledare_id] = (platsAntal[p.handledare_id] || 0) + 1
        }
      }
    }

    const ut: Rad[] = handledare.map((x: any) => {
      const s = stat[x.id]
      return {
        id: x.id,
        name: x.name,
        email: x.email,
        phone: x.phone,
        roll: x.roll,
        aktiv: x.aktiv,
        harKonto: !!x.user_id,
        foretag: x.companies?.company_name || 'Okänt företag',
        ort: x.companies?.city || null,
        companyId: x.company_id,
        mottagna: s?.mottagna || 0,
        pagaende: s?.pagaende || 0,
        senast: s?.senast || null,
        utbildningar: s ? Array.from(s.utb) : [],
        oppnaPlatser: platsAntal[x.id] || 0,
      }
    })

    ut.sort((a, b) => b.mottagna - a.mottagna || a.name.localeCompare(b.name, 'sv'))
    setRader(ut)
    setLoading(false)
  }

  const synliga = rader.filter(r => {
    if (filter === 'erfarna' && r.mottagna === 0) return false
    if (filter === 'konto'   && !r.harKonto)      return false
    if (filter === 'platser' && r.oppnaPlatser === 0) return false

    if (!sok.trim()) return true
    const q = sok.toLowerCase()
    return [r.name, r.foretag, r.ort, r.roll, r.email]
      .filter(Boolean)
      .some(v => (v as string).toLowerCase().includes(q))
  })

  const totalMottagna = rader.reduce((s, r) => s + r.mottagna, 0)
  const medKonto      = rader.filter(r => r.harKonto).length
  const medPlatser    = rader.filter(r => r.oppnaPlatser > 0).length

  function arstal(iso: string | null) {
    if (!iso) return null
    const d = new Date(iso)
    return d.toLocaleDateString('sv-SE', { month: 'short', year: 'numeric' })
  }

  if (loading) return (
    <div className="min-h-screen bg-paper flex items-center justify-center">
      <p className="text-muted text-sm">Laddar</p>
    </div>
  )

  const filterKnappar = [
    { v: 'alla',    t: 'Alla' },
    { v: 'erfarna', t: 'Har tagit emot' },
    { v: 'platser', t: 'Söker nu' },
    { v: 'konto',   t: 'Har konto' },
  ]

  return (
    <div className="min-h-screen bg-paper text-text flex flex-col lg:flex-row">
      <Sidebar
        role="education"
        name={profile?.full_name}
        subtitle={(current as any)?.program_name}
      />

      <main className="flex-1 p-5 sm:p-8 max-w-4xl">
        <h1 className="text-2xl sm:text-3xl mb-1">Handledare</h1>
        <p className="text-muted text-sm mb-7">
          Personerna bakom företagen i nätverket. Den som tagit emot fyra studenter
          och vill ta en femte är mer värd att ringa än ett företagsnamn utan ansikte.
        </p>

        {rader.length === 0 ? (
          <div className="bg-card border border-line rounded-xl p-10 text-center">
            <p className="mb-1">Inga handledare än</p>
            <p className="text-muted text-sm leading-relaxed">
              Handledare skapas när du skriver in namnet i ett LIA-avtal, eller när ett
              företag lägger till dem själva. De behöver inget konto för att synas här.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              {[
                { n: rader.length,   label: 'handledare' },
                { n: totalMottagna,  label: 'studenter mottagna' },
                { n: medPlatser,     label: 'söker just nu' },
                { n: medKonto,       label: 'har konto' },
              ].map((s, i) => (
                <div key={i} className="bg-card border border-line rounded-xl p-4">
                  <p className="font-display text-2xl font-extrabold">{s.n}</p>
                  <p className="text-muted text-xs mt-1 leading-snug">{s.label}</p>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-3 mb-5">
              <input
                value={sok}
                onChange={e => setSok(e.target.value)}
                placeholder="Sök namn, företag, ort"
                className="flex-1 min-w-48 bg-card border border-line rounded-full px-4 py-2.5 text-sm outline-none focus:border-text/40 transition"
              />
              <div className="flex gap-1.5 flex-wrap">
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
            </div>

            {synliga.length === 0 ? (
              <div className="bg-card border border-line rounded-xl p-10 text-center">
                <p className="text-muted text-sm">Inget som matchar.</p>
              </div>
            ) : (
              <div className="bg-card border border-line rounded-xl divide-y divide-line">
                {synliga.map(r => (
                  <div key={r.id} className={`px-5 py-4 ${r.aktiv ? '' : 'opacity-50'}`}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">
                          {r.name}
                          {!r.aktiv && <span className="text-muted font-normal"> — inaktiv</span>}
                        </p>
                        <p className="text-muted text-sm">
                          {r.foretag}{r.ort ? ', ' + r.ort : ''}
                          {r.roll ? ' · ' + r.roll : ''}
                        </p>
                        <p className="text-muted text-sm">
                          {[r.email, r.phone].filter(Boolean).join(', ') || 'Inga kontaktuppgifter'}
                        </p>
                        {r.utbildningar.length > 0 && (
                          <p className="text-muted text-xs mt-1.5">
                            Tagit emot från {r.utbildningar.join(', ')}
                          </p>
                        )}
                      </div>

                      <div className="text-right shrink-0">
                        <p className="font-display text-xl font-extrabold">
                          {r.mottagna}
                        </p>
                        <p className="text-muted text-xs">
                          {r.mottagna === 1 ? 'student' : 'studenter'}
                        </p>
                        <div className="flex flex-col items-end gap-1 mt-2">
                          {r.pagaende > 0 && (
                            <span className="bg-ok/10 text-ok rounded-full px-2.5 py-0.5 text-xs">
                              {r.pagaende} pågår
                            </span>
                          )}
                          {r.oppnaPlatser > 0 && (
                            <span className="bg-accent/10 text-accent rounded-full px-2.5 py-0.5 text-xs">
                              söker {r.oppnaPlatser}
                            </span>
                          )}
                          {r.senast && (
                            <span className="text-muted text-xs">
                              senast {arstal(r.senast)}
                            </span>
                          )}
                          {!r.harKonto && (
                            <span className="text-muted text-xs">utan konto</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <p className="text-muted text-xs mt-5 leading-relaxed">
              Räknade studenter är placeringar med avtal, pågående eller avslutad LIA.
              Listan visar handledare hos företag i din skolas nätverk och hos företag
              som redan tagit emot någon av dina studenter.
            </p>
          </>
        )}
      </main>
    </div>
  )
}
