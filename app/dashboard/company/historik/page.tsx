'use client'
import { useEffect, useState } from 'react'
import { createClient } from '../../../lib/supabase'
import { useRouter } from 'next/navigation'
import Sidebar from '../../../components/Sidebar'

function platta(v: any) { return Array.isArray(v) ? v[0] : v }

export default function ForetagHistorik() {
  const [profile, setProfile] = useState<any>(null)
  const [company, setCompany] = useState<any>(null)
  const [rader, setRader]     = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const supabase = createClient()
  const router   = useRouter()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: prof } = await supabase
        .from('profiles').select('*').eq('id', user.id).single()
      setProfile(prof)

      let { data: co } = await supabase
        .from('companies').select('*').eq('user_id', user.id).maybeSingle()

      if (!co) {
        const { data: medlem } = await supabase
          .from('company_members').select('companies(*)').eq('user_id', user.id).maybeSingle()
        co = platta((medlem as any)?.companies)
      }

      setCompany(co)

      if (co) {
        const { data: pl } = await supabase
          .from('placements')
          .select(`
            id, status, actual_start, actual_end,
            lia_periods(name, start_date, end_date, weeks, classes(name, termin, educations(program_name, school_name))),
            students(profiles(full_name))
          `)
          .eq('company_id', (co as any).id)
        setRader(pl || [])
      }

      setLoading(false)
    }
    load()
  }, [])

  function datum(p: any) {
    const per = platta(p.lia_periods)
    return p.actual_start || (per as any)?.start_date || ''
  }

  const avslutade = rader
    .filter(p => ['aktiv', 'klar'].includes(p.status))
    .sort((a, b) => (datum(b) || '').localeCompare(datum(a) || ''))

  const pagaende = rader.filter(p => p.status === 'avtal')

  const veckor = avslutade.reduce((a, p) => {
    const per = platta(p.lia_periods)
    return a + ((per as any)?.weeks || 0)
  }, 0)

  const utbildningar = Array.from(new Set(
    rader.map(p => {
      const per = platta(p.lia_periods)
      const kl  = platta((per as any)?.classes)
      return platta((kl as any)?.educations)?.program_name
    }).filter(Boolean)
  ))

  const forstaAret = avslutade.length
    ? (datum(avslutade[avslutade.length - 1]) || '').slice(0, 4)
    : ''

  if (loading) return (
    <div className="min-h-screen bg-paper flex items-center justify-center">
      <p className="text-muted text-sm">Laddar</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-paper text-text flex flex-col lg:flex-row">
      <Sidebar role="company" name={profile?.full_name} subtitle={company?.company_name} />

      <main className="flex-1 p-5 sm:p-8 max-w-3xl">
        <h1 className="text-2xl sm:text-3xl mb-1">Studenter ni tagit emot</h1>
        <p className="text-muted text-sm mb-7">
          {forstaAret
            ? `Sedan ${forstaAret} har ni varit en del av utbildningen för ${avslutade.length} ${avslutade.length === 1 ? 'person' : 'personer'}.`
            : 'Här samlas alla LIA-perioder ni haft.'}
        </p>

        {rader.length === 0 ? (
          <div className="bg-card border border-line rounded-xl p-12 text-center">
            <p className="mb-1">Ingen historik än</p>
            <p className="text-muted text-sm">
              Den första studenten dyker upp här när LIA-perioden är igång.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-7">
              {[
                { n: avslutade.length,      label: 'studenter totalt' },
                { n: veckor || '—',         label: 'veckors handledning' },
                { n: utbildningar.length,   label: utbildningar.length === 1 ? 'utbildning' : 'utbildningar' },
                { n: pagaende.length,       label: 'pågår nu' },
              ].map((s, i) => (
                <div key={i} className="bg-card border border-line rounded-xl p-5">
                  <p className="font-display text-3xl font-extrabold">{s.n}</p>
                  <p className="text-muted text-sm mt-1 leading-snug">{s.label}</p>
                </div>
              ))}
            </div>

            {pagaende.length > 0 && (
              <section className="mb-7">
                <h2 className="text-base mb-3">Pågår nu</h2>
                <div className="bg-card border border-line rounded-xl divide-y divide-line">
                  {pagaende.map(p => {
                    const per = platta(p.lia_periods)
                    const kl  = platta((per as any)?.classes)
                    const edu = platta((kl as any)?.educations)
                    const st  = platta(p.students)
                    return (
                      <div key={p.id} className="px-5 py-4">
                        <p className="text-sm font-medium">
                          {platta((st as any)?.profiles)?.full_name}
                        </p>
                        <p className="text-muted text-sm mt-0.5">
                          {(edu as any)?.program_name}, {(per as any)?.name}
                        </p>
                        <p className="text-muted text-sm">
                          {p.actual_start || (per as any)?.start_date} till {p.actual_end || (per as any)?.end_date}
                        </p>
                      </div>
                    )
                  })}
                </div>
              </section>
            )}

            {avslutade.length > 0 && (
              <section>
                <h2 className="text-base mb-3">Tidigare</h2>
                <div className="bg-card border border-line rounded-xl divide-y divide-line">
                  {avslutade.map(p => {
                    const per = platta(p.lia_periods)
                    const kl  = platta((per as any)?.classes)
                    const edu = platta((kl as any)?.educations)
                    const st  = platta(p.students)
                    return (
                      <div key={p.id} className="px-5 py-4 flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium">
                            {platta((st as any)?.profiles)?.full_name}
                          </p>
                          <p className="text-muted text-sm mt-0.5">
                            {(edu as any)?.program_name}
                            {(kl as any)?.name ? ', ' + (kl as any).name : ''}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-muted text-sm">
                            {(per as any)?.name}
                          </p>
                          <p className="text-muted text-sm">
                            {p.actual_start || (per as any)?.start_date}
                            {(per as any)?.weeks ? ', ' + (per as any).weeks + ' veckor' : ''}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>
            )}

            {utbildningar.length > 0 && (
              <p className="text-muted text-sm mt-7 leading-relaxed">
                Ni har tagit emot studerande från {utbildningar.join(', ')}.
                Tack för att ni gör LIA möjlig.
              </p>
            )}
          </>
        )}
      </main>
    </div>
  )
}