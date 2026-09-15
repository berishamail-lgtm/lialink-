'use client'
import { useEffect, useState } from 'react'
import { createClient } from '../../lib/supabase'
import { useRouter } from 'next/navigation'
import Sidebar from '../../components/Sidebar'

export default function CompanyDashboard() {
  const [profile, setProfile]   = useState<any>(null)
  const [company, setCompany]   = useState<any>(null)
  const [matches, setMatches]   = useState<any[]>([])
  const [placed, setPlaced]     = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const supabase = createClient()
  const router   = useRouter()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: prof } = await supabase
        .from('profiles').select('*').eq('id', user.id).single()
      setProfile(prof)

      const { data: co } = await supabase
        .from('companies').select('*').eq('user_id', user.id).single()
      setCompany(co)

      if (co) {
        const { data: m } = await supabase
          .from('matches')
          .select(`
            *,
            placements(
              id, status, actual_start, actual_end,
              lia_periods(name, start_date, end_date, weeks, classes(name, educations(program_name, school_name)))
            ),
            students(user_id, program, bio, skills, profiles(full_name, city))
          `)
          .eq('company_id', co.id)
          .order('score', { ascending: false })

        const alla = m || []
        setMatches(alla.filter(x => ['söker', 'uppskjuten'].includes(x.placements?.status)))
        setPlaced(alla.filter(x => ['avtal', 'aktiv', 'klar'].includes(x.placements?.status)))
      }

      setLoading(false)
    }
    load()
  }, [])

  if (loading) return (
    <div className="min-h-screen bg-paper flex items-center justify-center">
      <p className="text-muted text-sm">Laddar</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-paper text-text flex flex-col lg:flex-row">
      <Sidebar role="company" name={profile?.full_name} subtitle={company?.company_name} />

      <main className="flex-1 p-5 sm:p-8 max-w-3xl">
        <h1 className="text-2xl sm:text-3xl mb-1">Kandidater</h1>
        <p className="text-muted text-sm mb-7">
          {company
            ? 'Studenter som matchar det ni söker, er ort och er period.'
            : 'Fyll i företagsprofilen så börjar vi matcha er mot studenter.'}
        </p>

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
              <div className="bg-card border border-line rounded-xl p-10 text-center">
                <p className="mb-1">Inga kandidater just nu</p>
                <p className="text-muted text-sm">
                  Nya studenter matchas löpande. Stämmer er period och ort med de utbildningar
                  ni vill ta emot från dyker de upp här.
                </p>
              </div>
            ) : (
              <div className="space-y-3 mb-8">
                {matches.map(m => {
                  const p     = m.placements
                  const start = p?.actual_start || p?.lia_periods?.start_date
                  const end   = p?.actual_end   || p?.lia_periods?.end_date
                  const edu   = p?.lia_periods?.classes?.educations

                  return (
                    <article key={m.id} className="bg-card border border-line rounded-xl p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                        <div className="min-w-0">
                          <h2 className="text-base">{m.students?.profiles?.full_name}</h2>
                          <p className="text-muted text-sm mt-0.5">
                            {edu?.program_name}
                            {m.students?.profiles?.city ? `, ${m.students.profiles.city}` : ''}
                          </p>
                          <p className="text-muted text-sm">
                            {p?.lia_periods?.name}, {start} till {end}
                            {p?.lia_periods?.weeks ? `, ${p.lia_periods.weeks} veckor` : ''}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-display text-2xl font-extrabold text-ok">{m.score}%</p>
                          <p className="text-muted text-xs">matchning</p>
                        </div>
                      </div>

                      {m.students?.bio && (
                        <p className="text-sm leading-relaxed mb-3">{m.students.bio}</p>
                      )}

                      {m.students?.skills?.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-4">
                          {m.students.skills.map((s: string) => (
                            <span key={s} className="bg-paper border border-line rounded-full px-2.5 py-1 text-xs text-muted">
                              {s}
                            </span>
                          ))}
                        </div>
                      )}

                      <button
                        onClick={() => router.push(`/dashboard/messages?to=${m.students?.user_id}&name=${encodeURIComponent(m.students?.profiles?.full_name || '')}`)}
                        className="bg-text text-paper rounded-full px-5 py-2 text-sm font-medium hover:opacity-85 transition"
                      >
                        Kontakta
                      </button>
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
                    const p = m.placements
                    return (
                      <div key={m.id} className="px-5 py-4 flex flex-wrap items-baseline justify-between gap-2">
                          <div>
                          <p className="text-sm font-medium">{m.students?.profiles?.full_name}</p>
                          <p className="text-muted text-sm">
                            {p?.lia_periods?.name}, {p?.actual_start || p?.lia_periods?.start_date} till {p?.actual_end || p?.lia_periods?.end_date}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-muted text-sm">{p?.status}</span>
                          <button onClick={() => router.push('/dashboard/messages?to=' + m.students?.user_id + '&name=' + encodeURIComponent(m.students?.profiles?.full_name || ''))} className="border border-line rounded-full px-4 py-1.5 text-sm text-muted hover:border-text/30 transition">Meddelande</button>
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