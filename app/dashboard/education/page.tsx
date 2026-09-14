'use client'
import { useEffect, useState } from 'react'
import { createClient } from '../../lib/supabase'
import { useRouter } from 'next/navigation'
import Sidebar from '../../components/Sidebar'

export default function EducationDashboard() {
  const [profile, setProfile]     = useState<any>(null)
  const [education, setEducation] = useState<any>(null)
  const [students, setStudents]   = useState<any[]>([])
  const [agreements, setAgreements] = useState<any[]>([])
  const [loading, setLoading]     = useState(true)
  const [matching, setMatching]   = useState(false)
  const supabase = createClient()
  const router   = useRouter()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: prof } = await supabase
        .from('profiles').select('*').eq('id', user.id).single()
      setProfile(prof)

      const { data: edu } = await supabase
        .from('educations').select('*').eq('user_id', user.id).single()
      setEducation(edu)

      const { data: studs } = await supabase
        .from('students').select('*, profiles(full_name, email, city)')
      setStudents(studs || [])

      const { data: agrs } = await supabase
        .from('agreements').select('*, students(user_id), companies(company_name)')
      setAgreements(agrs || [])

      setLoading(false)
    }
    load()
  }, [])

  async function runMatching() {
    setMatching(true)
    const res  = await fetch('/api/match', { method: 'POST' })
    const data = await res.json()
    setMatching(false)
    alert(data.message)
    window.location.reload()
  }

  // Räkna veckor kvar till LIA-start
  function weeksUntil(dateStr: string | null): number | null {
    if (!dateStr) return null
    const diff = new Date(dateStr).getTime() - Date.now()
    return Math.round(diff / (1000 * 60 * 60 * 24 * 7))
  }

  const groups = {
    klar:    students.filter(s => ['aktiv', 'klar'].includes(s.status)),
    avtal:   students.filter(s => s.status === 'avtal'),
    matchad: students.filter(s => s.status === 'matchad'),
    soker:   students.filter(s => s.status === 'söker'),
  }

  // Studenter utan plats där LIA börjar inom 8 veckor
  const brådskande = groups.soker.filter(s => {
    const w = weeksUntil(s.lia_period_start)
    return w !== null && w <= 8
  })

  const signerade = agreements.filter(a => a.all_signed)
  const total     = students.length

  const bars = [
    { label: 'LIA-plats klar',     count: groups.klar.length,    color: 'bg-ok' },
    { label: 'Avtal pågår',        count: groups.avtal.length,   color: 'bg-[#2563eb]' },
    { label: 'Matchad',            count: groups.matchad.length, color: 'bg-warn' },
    { label: 'Söker fortfarande',  count: groups.soker.length,   color: 'bg-alert' },
  ]

  if (loading) return (
    <div className="min-h-screen bg-paper flex items-center justify-center">
      <p className="text-muted text-sm">Laddar</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-paper text-text flex flex-col lg:flex-row">
      <Sidebar name={profile?.full_name} program={education?.program_name} />

      <main className="flex-1 p-5 sm:p-8 max-w-6xl">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-7">
          <div>
            <h1 className="text-2xl sm:text-3xl mb-1">Översikt</h1>
            <p className="text-muted text-sm">
              {education?.program_name}{education?.city ? `, ${education.city}` : ''}
            </p>
          </div>
          <button
            onClick={runMatching}
            disabled={matching}
            className="bg-accent text-white px-5 py-2.5 rounded-full text-sm font-medium hover:opacity-85 transition disabled:opacity-50"
          >
            {matching ? 'Matchar' : 'Kör matchning'}
          </button>
        </div>

        {brådskande.length > 0 && (
          <div className="bg-alert/8 border border-alert/25 rounded-xl px-5 py-4 mb-6 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-alert">
              <strong>{brådskande.length} {brådskande.length === 1 ? 'student' : 'studenter'}</strong> saknar
              LIA-plats med mindre än 8 veckor till start
            </p>
            <a href="/dashboard/students" className="text-sm text-alert underline underline-offset-4">
              Visa dem
            </a>
          </div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {[
            { n: total,                 label: 'studenter totalt',  accent: 'border-l-text' },
            { n: groups.klar.length,    label: 'har LIA-plats',     accent: 'border-l-ok' },
            { n: signerade.length,      label: 'avtal signerade',   accent: 'border-l-[#2563eb]' },
            { n: groups.soker.length,   label: 'söker fortfarande', accent: 'border-l-alert' },
          ].map((c, i) => (
            <div key={i} className={`bg-card border border-line border-l-[3px] ${c.accent} rounded-xl p-5`}>
              <p className="font-display text-4xl font-extrabold">{c.n}</p>
              <p className="text-muted text-sm mt-1">{c.label}</p>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-4">
          <section className="bg-card border border-line rounded-xl p-6">
            <h2 className="text-base mb-5">Var studenterna ligger till</h2>
            {total === 0 ? (
              <p className="text-muted text-sm">
                Inga studenter har anslutit sig än. De syns här så fort de skapat sin profil.
              </p>
            ) : (
              <div className="space-y-4">
                {bars.map(bar => (
                  <div key={bar.label}>
                    <div className="flex justify-between text-sm mb-1.5">
                      <span>{bar.label}</span>
                      <span className="text-muted">{bar.count}</span>
                    </div>
                    <div className="h-1.5 bg-line rounded-full overflow-hidden">
                      <div
                        className={`h-full ${bar.color} rounded-full transition-[width] duration-500`}
                        style={{ width: `${total ? (bar.count / total) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="bg-card border border-line rounded-xl p-6">
            <h2 className="text-base mb-5">Behöver din uppmärksamhet</h2>
            {brådskande.length === 0 && signerade.length === 0 ? (
              <p className="text-muted text-sm">
                Inget som brådskar just nu.
              </p>
            ) : (
              <div className="space-y-2.5">
                {brådskande.slice(0, 4).map(s => {
                  const w = weeksUntil(s.lia_period_start)
                  return (
                    <div key={s.id} className="bg-alert/8 border border-alert/20 rounded-lg px-4 py-3">
                      <p className="text-sm">
                        {s.profiles?.full_name} saknar plats
                        {w !== null && ` med ${w} ${w === 1 ? 'vecka' : 'veckor'} kvar`}
                      </p>
                    </div>
                  )
                })}
                {signerade.slice(0, 3).map(a => (
                  <div key={a.id} className="bg-ok/8 border border-ok/20 rounded-lg px-4 py-3">
                    <p className="text-sm text-ok">
                      Avtal klart med {a.companies?.company_name}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  )
}