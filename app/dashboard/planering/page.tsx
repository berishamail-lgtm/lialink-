'use client'
import { useEffect, useState } from 'react'
import { createClient } from '../../lib/supabase'
import { useRouter } from 'next/navigation'
import Sidebar from '../../components/Sidebar'
import { useEdu } from '../../components/EduContext'

export default function PlaneringPage() {
  const [profile, setProfile]     = useState<any>(null)
  const [education, setEducation] = useState<any>(null)
  const [classes, setClasses]     = useState<any[]>([])
  const [periods, setPeriods]     = useState<any[]>([])
  const [counts, setCounts]       = useState<Record<string, number>>({})
  const [loading, setLoading]     = useState(true)

  const [showClass, setShowClass] = useState(false)
  const [cName, setCName]         = useState('')
  const [cKod, setCKod]           = useState('')
  const [cStart, setCStart]       = useState('')
  const [cEnd, setCEnd]           = useState('')

  const [periodFor, setPeriodFor] = useState('')
  const [pName, setPName]         = useState('')
  const [pStart, setPStart]       = useState('')
  const [pEnd, setPEnd]           = useState('')

  const [error, setError]         = useState('')
  const supabase = createClient()
  const router   = useRouter()
  const { current } = useEdu()

  useEffect(() => { if (current) load() }, [current?.id])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: prof } = await supabase
      .from('profiles').select('*').eq('id', user.id).single()
    setProfile(prof)

      const edu = current
      setEducation(edu)

      if (edu) {
      const { data: cls } = await supabase
        .from('classes').select('*').eq('education_id', edu.id)
        .order('start_date', { ascending: false })
      setClasses(cls || [])

      const ids = (cls || []).map(c => c.id)
      if (ids.length) {
        const { data: per } = await supabase
          .from('lia_periods').select('*').in('class_id', ids)
          .order('sequence')
        setPeriods(per || [])

        const { data: studs } = await supabase
          .from('students').select('class_id').in('class_id', ids)
        const map: Record<string, number> = {}
        for (const s of studs || []) {
          if (s.class_id) map[s.class_id] = (map[s.class_id] || 0) + 1
        }
        setCounts(map)
      } else {
        setPeriods([])
      }
    }
    setLoading(false)
  }

  async function saveClass(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const { error } = await supabase.from('classes').insert({
      education_id: education.id,
      name:       cName.trim(),
      yh_kod:     cKod.trim(),
      start_date: cStart || null,
      end_date:   cEnd   || null,
    })
    if (error) {
      setError(error.message.includes('duplicate')
        ? 'YH-koden används redan. Varje klass måste ha en egen kod.'
        : error.message)
      return
    }
    setCName(''); setCKod(''); setCStart(''); setCEnd(''); setShowClass(false)
    load()
  }

  async function savePeriod(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const existing = periods.filter(p => p.class_id === periodFor)
    const weeks = pStart && pEnd
      ? Math.round((new Date(pEnd).getTime() - new Date(pStart).getTime()) / (1000*60*60*24*7))
      : null

    const { error } = await supabase.from('lia_periods').insert({
      class_id:   periodFor,
      name:       pName.trim(),
      sequence:   existing.length + 1,
      start_date: pStart,
      end_date:   pEnd,
      weeks,
    })
    if (error) { setError(error.message); return }
    setPName(''); setPStart(''); setPEnd(''); setPeriodFor('')
    load()
  }

  const field = 'w-full bg-paper border border-line rounded-lg px-4 py-2.5 text-sm outline-none focus:border-text/40 transition'

  if (loading) return (
    <div className="min-h-screen bg-paper flex items-center justify-center">
      <p className="text-muted text-sm">Laddar</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-paper text-text flex flex-col lg:flex-row">
      <Sidebar role="education" name={profile?.full_name} subtitle={education?.program_name} />

      <main className="flex-1 p-5 sm:p-8 max-w-3xl">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-2">
          <h1 className="text-2xl sm:text-3xl">Klasser och LIA-perioder</h1>
          <button
            onClick={() => { setShowClass(!showClass); setError('') }}
            className="bg-accent text-white px-5 py-2.5 rounded-full text-sm font-medium hover:opacity-85 transition"
          >
            {showClass ? 'Avbryt' : 'Ny klass'}
          </button>
        </div>
        <p className="text-muted text-sm mb-7">
          Studenter ansluter till sin klass med YH-koden. Dela koden med dem vid kursstart.
        </p>

        {error && (
          <p className="bg-alert/10 border border-alert/25 text-alert text-sm rounded-lg px-4 py-3 mb-5">
            {error}
          </p>
        )}

        {showClass && (
          <form onSubmit={saveClass} className="bg-card border border-line rounded-xl p-6 mb-5 space-y-4">
            <h2 className="text-base">Ny klass</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm mb-1.5">Klassnamn</label>
                <input value={cName} onChange={e => setCName(e.target.value)} required placeholder="SI25" className={field} />
              </div>
              <div>
                <label className="block text-sm mb-1.5">YH-kod</label>
                <input value={cKod} onChange={e => setCKod(e.target.value)} required placeholder="YH01234-2025" className={field} />
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm mb-1.5">Utbildningen startar</label>
                <input type="date" value={cStart} onChange={e => setCStart(e.target.value)} className={field} />
              </div>
              <div>
                <label className="block text-sm mb-1.5">Utbildningen slutar</label>
                <input type="date" value={cEnd} onChange={e => setCEnd(e.target.value)} className={field} />
              </div>
            </div>
            <button type="submit" className="bg-text text-paper rounded-full px-6 py-2.5 text-sm font-medium hover:opacity-85 transition">
              Spara klass
            </button>
          </form>
        )}

        {classes.length === 0 ? (
          <div className="bg-card border border-line rounded-xl p-12 text-center">
            <p className="mb-1">Inga klasser upplagda</p>
            <p className="text-muted text-sm">
              Lägg upp din första klass så kan studenter ansluta med YH-koden.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {classes.map(c => {
              const mine = periods.filter(p => p.class_id === c.id)
              return (
                <section key={c.id} className="bg-card border border-line rounded-xl overflow-hidden">
                  <div className="p-6 pb-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h2 className="text-lg">{c.name}</h2>
                        <p className="text-muted text-sm mt-0.5">
                          {counts[c.id] || 0} {counts[c.id] === 1 ? 'student' : 'studenter'} anslutna
                          {c.start_date && ` · ${c.start_date} till ${c.end_date || '—'}`}
                        </p>
                      </div>
                      <div className="bg-paper border border-line rounded-lg px-3 py-2">
                        <p className="text-muted text-xs">YH-kod</p>
                        <p className="text-sm font-medium">{c.yh_kod}</p>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-line">
                    {mine.length === 0 ? (
                      <p className="text-muted text-sm px-6 py-4">
                        Inga LIA-perioder upplagda för klassen.
                      </p>
                    ) : (
                      <ul className="divide-y divide-line">
                        {mine.map(p => (
                          <li key={p.id} className="px-6 py-3.5 flex flex-wrap items-baseline justify-between gap-2">
                            <span className="text-sm font-medium">{p.name}</span>
                            <span className="text-muted text-sm">
                              {p.start_date} till {p.end_date}
                              {p.weeks ? `, ${p.weeks} veckor` : ''}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="border-t border-line p-5 bg-paper/50">
                    {periodFor === c.id ? (
                      <form onSubmit={savePeriod} className="space-y-4">
                        <div>
                          <label className="block text-sm mb-1.5">Periodens namn</label>
                          <input value={pName} onChange={e => setPName(e.target.value)} required placeholder="LIA 1" className={field} />
                        </div>
                        <div className="grid sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm mb-1.5">Startar</label>
                            <input type="date" value={pStart} onChange={e => setPStart(e.target.value)} required className={field} />
                          </div>
                          <div>
                            <label className="block text-sm mb-1.5">Slutar</label>
                            <input type="date" value={pEnd} onChange={e => setPEnd(e.target.value)} required className={field} />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button type="submit" className="bg-text text-paper rounded-full px-6 py-2.5 text-sm font-medium hover:opacity-85 transition">
                            Spara period
                          </button>
                          <button type="button" onClick={() => setPeriodFor('')} className="text-muted text-sm px-4">
                            Avbryt
                          </button>
                        </div>
                      </form>
                    ) : (
                      <button
                        onClick={() => { setPeriodFor(c.id); setError('') }}
                        className="text-sm text-muted hover:text-text transition"
                      >
                        Lägg till LIA-period
                      </button>
                    )}
                  </div>
                </section>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}