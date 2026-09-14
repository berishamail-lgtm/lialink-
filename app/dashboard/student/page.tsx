'use client'
import { useEffect, useState } from 'react'
import { createClient } from '../../lib/supabase'
import { useRouter } from 'next/navigation'
import Sidebar from '../../components/Sidebar'

const statusText: Record<string, string> = {
  'söker':      'Söker plats',
  'förslag':    'Förslag inskickat',
  'matchad':    'Matchad',
  'avtal':      'Avtal pågår',
  'aktiv':      'Pågår',
  'klar':       'Klar',
  'uppskjuten': 'Uppskjuten',
  'avbruten':   'Avbruten',
}

const statusStyle: Record<string, string> = {
  'söker':      'bg-alert/10 text-alert',
  'förslag':    'bg-warn/10 text-warn',
  'matchad':    'bg-warn/10 text-warn',
  'avtal':      'bg-[#2563eb]/10 text-[#2563eb]',
  'aktiv':      'bg-ok/10 text-ok',
  'klar':       'bg-ok/10 text-ok',
  'uppskjuten': 'bg-muted/10 text-muted',
  'avbruten':   'bg-muted/10 text-muted',
}

export default function StudentDashboard() {
  const [profile, setProfile]       = useState<any>(null)
  const [student, setStudent]       = useState<any>(null)
  const [klass, setKlass]           = useState<any>(null)
  const [placements, setPlacements] = useState<any[]>([])
  const [matches, setMatches]       = useState<any[]>([])
  const [loading, setLoading]       = useState(true)
  const supabase = createClient()
  const router   = useRouter()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: prof } = await supabase
        .from('profiles').select('*').eq('id', user.id).single()
      setProfile(prof)

      const { data: s } = await supabase
        .from('students').select('*').eq('user_id', user.id).single()
      setStudent(s)

      if (s?.class_id) {
        const { data: c } = await supabase
          .from('classes').select('*, educations(program_name, school_name)')
          .eq('id', s.class_id).single()
        setKlass(c)
      }

      if (s) {
        const { data: pl } = await supabase
          .from('placements')
          .select('*, lia_periods(name, sequence, start_date, end_date, weeks), companies(company_name, city)')
          .eq('student_id', s.id)
        const sorted = (pl || []).sort(
          (a, b) => (a.lia_periods?.sequence || 0) - (b.lia_periods?.sequence || 0)
        )
        setPlacements(sorted)

        const ids = sorted.map(p => p.id)
        if (ids.length) {
          const { data: m } = await supabase
            .from('matches')
            .select('*, companies(user_id, company_name, sector, city, description)')
            .in('placement_id', ids)
            .order('score', { ascending: false })
          setMatches(m || [])
        }
      }

      setLoading(false)
    }
    load()
  }, [])

  function weeksUntil(d: string | null) {
    if (!d) return null
    return Math.round((new Date(d).getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 7))
  }

  // Vad studenten behöver göra just nu
  function nextStep(): { text: string; href?: string; link?: string } | null {
    if (!student)                return { text: 'Fyll i din profil med din YH-kod så kopplas du till din klass.', href: '/dashboard/student/profil', link: 'Till profilen' }
    if (!profile?.city)          return { text: 'Lägg till din ort. Utan den kan vi inte matcha dig mot företag nära dig.', href: '/dashboard/student/profil', link: 'Lägg till ort' }
    if (!student.skills?.length) return { text: 'Lägg till dina kompetenser. Matchningen jämför dem mot vad företagen söker.', href: '/dashboard/student/profil', link: 'Lägg till kompetenser' }

    const söker = placements.find(p => ['söker', 'uppskjuten'].includes(p.status))
    if (söker) {
      const mina = matches.filter(m => m.placement_id === söker.id)
      if (mina.length) return { text: `Du har ${mina.length} ${mina.length === 1 ? 'företag' : 'företag'} som matchar. Hör av dig till dem.`, href: '#matchningar', link: 'Se matchningar' }
      return { text: 'Inga matchningar än. Du kan också kontakta ett företag du hittat själv.', href: '/dashboard/student/profil', link: 'Se över din profil' }
    }

    const avtal = placements.find(p => p.status === 'avtal')
    if (avtal) return { text: 'Ditt avtal väntar på din signering.', href: '/dashboard/agreements', link: 'Till avtalet' }

    return null
  }

  const step = nextStep()

  if (loading) return (
    <div className="min-h-screen bg-paper flex items-center justify-center">
      <p className="text-muted text-sm">Laddar</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-paper text-text flex flex-col lg:flex-row">
      <Sidebar role="student" name={profile?.full_name} subtitle={klass?.name} />

      <main className="flex-1 p-5 sm:p-8 max-w-3xl">
        <h1 className="text-2xl sm:text-3xl mb-1">Min LIA</h1>
        <p className="text-muted text-sm mb-7">
          {klass
            ? `${klass.educations?.program_name}, klass ${klass.name}`
            : 'Du är inte kopplad till någon klass än.'}
        </p>

        {step && (
          <div className="bg-accent/8 border border-accent/25 rounded-xl px-5 py-4 mb-6 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm">{step.text}</p>
            {step.href && (
              <a href={step.href} className="text-sm text-accent underline underline-offset-4 shrink-0">
                {step.link}
              </a>
            )}
          </div>
        )}

        {placements.length === 0 ? (
          <div className="bg-card border border-line rounded-xl p-10 text-center">
            <p className="mb-1">Inga LIA-perioder än</p>
            <p className="text-muted text-sm">
              Perioderna dyker upp här när du kopplat dig till din klass med YH-koden.
            </p>
          </div>
        ) : (
          <div className="space-y-4 mb-8">
            {placements.map(p => {
              const start = p.actual_start || p.lia_periods?.start_date
              const end   = p.actual_end   || p.lia_periods?.end_date
              const w     = weeksUntil(start)
              const skjuten = !!p.actual_start

              return (
                <section key={p.id} className="bg-card border border-line rounded-xl p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                    <div>
                      <h2 className="text-lg">{p.lia_periods?.name}</h2>
                      <p className="text-muted text-sm mt-0.5">
                        {start} till {end}
                        {p.lia_periods?.weeks ? `, ${p.lia_periods.weeks} veckor` : ''}
                        {skjuten && ' (justerat datum)'}
                      </p>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium shrink-0 ${statusStyle[p.status] || ''}`}>
                      {statusText[p.status] || p.status}
                    </span>
                  </div>

                  {p.companies ? (
                    <p className="text-sm">
                      Plats hos <strong>{p.companies.company_name}</strong>
                      {p.companies.city ? `, ${p.companies.city}` : ''}
                    </p>
                  ) : ['söker', 'uppskjuten'].includes(p.status) && w !== null && w <= 8 && w >= 0 ? (
                    <p className="text-alert text-sm">
                      {w} {w === 1 ? 'vecka' : 'veckor'} kvar till start och ingen plats klar än.
                    </p>
                  ) : (
                    <p className="text-muted text-sm">Ingen plats bokad än.</p>
                  )}
                </section>
              )
            })}
          </div>
        )}

        <div id="matchningar">
          <h2 className="text-lg mb-1">Företag som matchar dig</h2>
          <p className="text-muted text-sm mb-4">
            Sorterade efter hur väl de stämmer med din ort, dina kompetenser och din period.
          </p>

          {matches.length === 0 ? (
            <div className="bg-card border border-line rounded-xl p-10 text-center">
              <p className="mb-1">Inga matchningar än</p>
              <p className="text-muted text-sm">
                Din utbildningsledare kör matchningen löpande. Har du hittat ett företag själv kan du berätta det för hen.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {matches.map(m => {
                const pl = placements.find(p => p.id === m.placement_id)
                return (
                  <article key={m.id} className="bg-card border border-line rounded-xl p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="text-base">{m.companies?.company_name}</h3>
                        <p className="text-muted text-sm mt-0.5">
                          {m.companies?.sector}
                          {m.companies?.city ? `, ${m.companies.city}` : ''}
                          {pl?.lia_periods?.name ? ` · för ${pl.lia_periods.name}` : ''}
                        </p>
                        {m.companies?.description && (
                          <p className="text-muted text-sm mt-2 leading-relaxed">
                            {m.companies.description}
                          </p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-display text-2xl font-extrabold text-ok">{m.score}%</p>
                        <p className="text-muted text-xs">matchning</p>
                      </div>
                    </div>
                    <button
                      onClick={() => router.push(`/dashboard/messages?to=${m.companies?.user_id}&name=${encodeURIComponent(m.companies?.company_name || '')}`)}
                      className="mt-4 bg-text text-paper rounded-full px-5 py-2 text-sm font-medium hover:opacity-85 transition"
                    >
                      Kontakta {m.companies?.company_name}
                    </button>
                  </article>
                )
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}