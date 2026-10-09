'use client'
import { useEffect, useState } from 'react'
import { createClient } from '../../lib/supabase'
import { hamtaMittForetag } from '../../lib/foretag'
import { useRouter } from 'next/navigation'
import Sidebar from '../../components/Sidebar'

export default function CompanyDashboard() {
  const [profile, setProfile] = useState<any>(null)
  const [company, setCompany] = useState<any>(null)
  const [roll, setRoll]       = useState<string | null>(null)
  const [medlemId, setMedlemId] = useState<string | null>(null)
  const [matches, setMatches] = useState<any[]>([])
  const [placed, setPlaced]   = useState<any[]>([])
  const [anmalan, setAnmalan] = useState<Record<string, string>>({})
  const [anmalFor, setAnmalFor]   = useState('')
  const [anmalText, setAnmalText] = useState('')
  const [busy, setBusy]       = useState(false)
  const [error, setError]     = useState('')
  const [klart, setKlart]     = useState('')
  const [loading, setLoading] = useState(true)

  const supabase = createClient()
  const router   = useRouter()

  // Handledare ser bara sina egna placeringar, inte kandidatlistan.
  const barHandledare = roll === 'handledare'

  useEffect(() => { load() }, [])

  async function load() {
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
    if (!user) { router.push('/login'); return }

    const { data: prof } = await supabase
      .from('profiles').select('*').eq('id', user.id).maybeSingle()
    setProfile(prof)

    const mitt = await hamtaMittForetag(supabase, user.id)
    setCompany(mitt.company)
    setRoll(mitt.roll)
    setMedlemId(mitt.medlemId)

    if (mitt.company) {
      const { data: m } = await supabase
        .from('matches')
        .select(`
          *,
          placements(
            id, status, actual_start, actual_end, handledare_id,
            lia_periods(name, start_date, end_date, weeks, classes(name, educations(program_name, school_name)))
          ),
          students(user_id, program, bio, skills, cv_path, pb_path, profiles(full_name, city))
        `)
        .eq('company_id', mitt.company.id)
        .order('score', { ascending: false })

      let alla = m || []

      // En handledare ska bara se de studenter hon är handledare för.
      if (mitt.roll === 'handledare') {
        alla = alla.filter((x: any) => x.placements?.handledare_id === mitt.medlemId)
      }

      setMatches(alla.filter(x => ['söker', 'uppskjuten', 'förslag'].includes(x.placements?.status)))
      setPlaced(alla.filter(x => ['avtal', 'aktiv', 'klar'].includes(x.placements?.status)))

      const plIds = alla.map((x: any) => x.placements?.id).filter(Boolean)
      if (plIds.length) {
        const { data: anm } = await supabase
          .from('platsanmalan').select('placement_id, status')
          .in('placement_id', plIds).eq('company_id', mitt.company.id)

        const am: Record<string, string> = {}
        for (const a of anm || []) am[a.placement_id] = a.status
        setAnmalan(am)
      }
    }

    setLoading(false)
  }

  async function anmalPlats(placementId: string) {
    setBusy(true); setError(''); setKlart('')

    const res = await fetch('/api/platsanmalan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        placementId,
        companyId: company?.id,
        userId: profile?.id,
        meddelande: anmalText,
      }),
    })
    const data = await res.json()
    setBusy(false)

    if (!res.ok) { setError(data.error || 'Kunde inte anmäla'); return }

    setKlart('Anmält. Utbildningsledaren hör av sig med avtalet.')
    setAnmalFor(''); setAnmalText('')
    load()
  }

  async function oppna(path: string) {
    const { data } = await supabase.storage
      .from('dokument').createSignedUrl(path, 60)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  function chatt(userId: string, namn: string) {
    router.push('/dashboard/messages?to=' + userId + '&name=' + encodeURIComponent(namn || ''))
  }

  if (loading) return (
    <div className="min-h-screen bg-paper flex items-center justify-center">
      <p className="text-muted text-sm">Laddar</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-paper text-text flex flex-col lg:flex-row">
      <Sidebar role="company" name={profile?.full_name} subtitle={company?.company_name} />

      <main className="flex-1 p-5 sm:p-8 max-w-3xl">
        <h1 className="text-2xl sm:text-3xl mb-1">
          {barHandledare ? 'Dina studenter' : 'Kandidater'}
        </h1>
        <p className="text-muted text-sm mb-7">
          {!company
            ? 'Fyll i företagsprofilen så börjar vi matcha er mot studenter.'
            : barHandledare
              ? 'Studenterna du är handledare för hos ' + company.company_name + '.'
              : 'Studenter som matchar det ni söker, er ort och er period.'}
        </p>

        {error && (
          <p className="bg-alert/10 border border-alert/25 text-alert text-sm rounded-lg px-4 py-3 mb-5">{error}</p>
        )}
        {klart && (
          <p className="bg-ok/10 border border-ok/25 text-ok text-sm rounded-lg px-4 py-3 mb-5">{klart}</p>
        )}

        {!company ? (
          <div className="bg-accent/8 border border-accent/25 rounded-xl p-6">
            <p className="mb-1">Företagsprofilen är inte ifylld</p>
            <p className="text-muted text-sm mb-4">
              Vi behöver veta er ort, era datum och vad ni söker för att kunna matcha er.
            </p>
            <button
              onClick={() => router.push('/dashboard/company/profil')}
              className="bg-accent text-white rounded-full px-5 py-2.5 text-sm font-medium hover:opacity-85 transition"
            >
              Fyll i profilen
            </button>
          </div>
        ) : barHandledare ? (
          <>
            {placed.length === 0 && matches.length === 0 ? (
              <div className="bg-card border border-line rounded-xl p-10 text-center">
                <p className="mb-1">Inga studenter än</p>
                <p className="text-muted text-sm">
                  När någon på {company.company_name} utser dig till handledare för en
                  student dyker hon upp här.
                </p>
              </div>
            ) : (
              <div className="bg-card border border-line rounded-xl divide-y divide-line">
                {[...matches, ...placed].map(m => {
                  const p  = m.placements
                  const st = m.students
                  return (
                    <div key={m.id} className="px-5 py-4 flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{st?.profiles?.full_name}</p>
                        <p className="text-muted text-sm">
                          {p?.lia_periods?.name}, {p?.actual_start || p?.lia_periods?.start_date} till {p?.actual_end || p?.lia_periods?.end_date}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-muted text-sm">{p?.status}</span>
                        <button
                          onClick={() => chatt(st?.user_id, st?.profiles?.full_name)}
                          className="border border-line rounded-full px-4 py-1.5 text-sm text-muted hover:border-text/30 transition"
                        >
                          Meddelande
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3 mb-7">
              {[
                { n: company.spots_total     ?? 0, label: 'platser totalt' },
                { n: company.spots_available ?? 0, label: 'lediga just nu' },
                { n: matches.length,               label: 'kandidater att titta på' },
              ].map((s, i) => (
                <div key={i} className="bg-card border border-line rounded-xl p-5">
                  <p className="font-display text-3xl font-extrabold">{s.n}</p>
                  <p className="text-muted text-sm mt-1 leading-snug">{s.label}</p>
                </div>
              ))}
            </div>

            {matches.length === 0 ? (
              <div className="bg-card border border-line rounded-xl p-10 text-center mb-8">
                <p className="mb-1">Inga kandidater just nu</p>
                <p className="text-muted text-sm">
                  Nya studenter matchas löpande. Stämmer er period och ort med de
                  utbildningar ni vill ta emot från dyker de upp här.
                </p>
              </div>
            ) : (
              <div className="space-y-3 mb-8">
                {matches.map(m => {
                  const p     = m.placements
                  const start = p?.actual_start || p?.lia_periods?.start_date
                  const end   = p?.actual_end   || p?.lia_periods?.end_date
                  const edu   = p?.lia_periods?.classes?.educations
                  const st    = m.students
                  const anm   = anmalan[p?.id]

                  return (
                    <article key={m.id} className="bg-card border border-line rounded-xl overflow-hidden">
                      <div className="p-5">
                        <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                          <div className="min-w-0">
                            <h2 className="text-base">{st?.profiles?.full_name}</h2>
                            <p className="text-muted text-sm mt-0.5">
                              {edu?.program_name}
                              {st?.profiles?.city ? ', ' + st.profiles.city : ''}
                            </p>
                            <p className="text-muted text-sm">
                              {p?.lia_periods?.name}, {start} till {end}
                              {p?.lia_periods?.weeks ? ', ' + p.lia_periods.weeks + ' veckor' : ''}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="font-display text-2xl font-extrabold text-ok">{m.score}%</p>
                            <p className="text-muted text-xs">matchning</p>
                          </div>
                        </div>

                        {st?.bio && (
                          <p className="text-sm leading-relaxed mb-3">{st.bio}</p>
                        )}

                        {st?.skills?.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mb-4">
                            {st.skills.map((s: string) => (
                              <span key={s} className="bg-paper border border-line rounded-full px-2.5 py-1 text-xs text-muted">
                                {s}
                              </span>
                            ))}
                          </div>
                        )}

                        <div className="flex flex-wrap items-center gap-4">
                          {anm === 'ny' ? (
                            <span className="bg-warn/10 text-warn rounded-full px-4 py-2 text-sm">
                              Anmäld, väntar på avtal
                            </span>
                          ) : anm === 'bekraftad' ? (
                            <span className="bg-ok/10 text-ok rounded-full px-4 py-2 text-sm">
                              Bekräftad av utbildningen
                            </span>
                          ) : (
                            <button
                              onClick={() => { setAnmalFor(p?.id); setError(''); setKlart('') }}
                              className="bg-accent text-white rounded-full px-5 py-2 text-sm font-medium hover:opacity-85 transition"
                            >
                              Vi tar emot
                            </button>
                          )}

                          <button
                            onClick={() => chatt(st?.user_id, st?.profiles?.full_name)}
                            className="bg-text text-paper rounded-full px-5 py-2 text-sm font-medium hover:opacity-85 transition"
                          >
                            Kontakta
                          </button>

                          {st?.cv_path && (
                            <button onClick={() => oppna(st.cv_path)}
                              className="text-muted hover:text-text text-sm underline underline-offset-4 decoration-line transition">
                              Läs CV
                            </button>
                          )}
                          {st?.pb_path && (
                            <button onClick={() => oppna(st.pb_path)}
                              className="text-muted hover:text-text text-sm underline underline-offset-4 decoration-line transition">
                              Läs personligt brev
                            </button>
                          )}
                        </div>
                      </div>

                      {anmalFor === p?.id && (
                        <div className="border-t border-line bg-paper/50 p-5 space-y-3">
                          <p className="text-sm font-medium">
                            Anmäl att ni tar emot {st?.profiles?.full_name}
                          </p>
                          <p className="text-muted text-sm">
                            Utbildningsledaren får besked och upprättar LIA-avtalet.
                            Ni signerar digitalt när det är klart.
                          </p>
                          <textarea
                            value={anmalText}
                            onChange={e => setAnmalText(e.target.value)}
                            rows={2}
                            placeholder="Något utbildningsledaren bör veta? Handledare, startdatum, annat."
                            className="w-full bg-card border border-line rounded-lg px-4 py-2.5 text-sm outline-none focus:border-text/40 transition resize-y"
                          />
                          <div className="flex gap-2">
                            <button onClick={() => anmalPlats(p.id)} disabled={busy}
                              className="bg-text text-paper rounded-full px-5 py-2 text-sm font-medium hover:opacity-85 transition disabled:opacity-40">
                              {busy ? 'Skickar' : 'Anmäl'}
                            </button>
                            <button onClick={() => setAnmalFor('')} className="text-muted text-sm px-3">
                              Avbryt
                            </button>
                          </div>
                        </div>
                      )}
                    </article>
                  )
                })}
              </div>
            )}

            {placed.length > 0 && (
              <section>
                <h2 className="text-lg mb-1">Studenter hos er</h2>
                <p className="text-muted text-sm mb-4">
                  Placeringar där avtal skapats eller LIA redan pågår.
                </p>
                <div className="bg-card border border-line rounded-xl divide-y divide-line">
                  {placed.map(m => {
                    const p  = m.placements
                    const st = m.students
                    return (
                      <div key={m.id} className="px-5 py-4 flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{st?.profiles?.full_name}</p>
                          <p className="text-muted text-sm">
                            {p?.lia_periods?.name}, {p?.actual_start || p?.lia_periods?.start_date} till {p?.actual_end || p?.lia_periods?.end_date}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-muted text-sm">{p?.status}</span>
                          <button
                            onClick={() => chatt(st?.user_id, st?.profiles?.full_name)}
                            className="border border-line rounded-full px-4 py-1.5 text-sm text-muted hover:border-text/30 transition"
                          >
                            Meddelande
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  )
}
