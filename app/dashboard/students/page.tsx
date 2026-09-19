'use client'
import { useEffect, useState } from 'react'
import { createClient } from '../../lib/supabase'
import { useRouter } from 'next/navigation'
import Sidebar from '../../components/Sidebar'
import { useEdu } from '../../components/EduContext'

const filters = [
  { value: 'alla',    label: 'Alla' },
  { value: 'söker',   label: 'Söker' },
  { value: 'matchad', label: 'Matchad' },
  { value: 'avtal',   label: 'Avtal' },
  { value: 'aktiv',   label: 'Pågår' },
  { value: 'klar',    label: 'Klar' },
]

const statusStyle: Record<string, string> = {
  'söker':   'bg-alert/10 text-alert',
  'matchad': 'bg-warn/10 text-warn',
  'avtal':   'bg-[#2563eb]/10 text-[#2563eb]',
  'aktiv':   'bg-ok/10 text-ok',
  'klar':    'bg-text/8 text-text',
}

export default function StudentsPage() {
  const [visaForm, setVisaForm] = useState(false)
  const [klasser, setKlasser]   = useState<any[]>([])
  const [nyNamn, setNyNamn]     = useState('')
  const [nyEpost, setNyEpost]   = useState('')
  const [nyOrt, setNyOrt]       = useState('')
  const [nyKlass, setNyKlass]   = useState('')
  const [busy, setBusy]         = useState(false)
  const [error, setError]       = useState('')
  const [klart, setKlart]       = useState('')
  const [profile, setProfile]     = useState<any>(null)
  const [education, setEducation] = useState<any>(null)
  const [students, setStudents]   = useState<any[]>([])
  const [filter, setFilter]       = useState('alla')
  const [search, setSearch]       = useState('')
  const [loading, setLoading]     = useState(true)
  const supabase = createClient()
  const router   = useRouter()
  const { current } = useEdu()
  const [perioder, setPerioder]     = useState<any[]>([])
  const [placeringar, setPlaceringar] = useState<any[]>([])

  useEffect(() => {
    if (!current) return
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: prof } = await supabase
        .from('profiles').select('*').eq('id', user.id).single()
      setProfile(prof)

      setEducation(current)

      const { data: cls } = await supabase
        .from('classes').select('id, name').eq('education_id', current.id)
      const classIds = (cls || []).map(c => c.id)
      setKlasser(cls || [])
      if (cls?.length && !nyKlass) setNyKlass(cls[0].id)

      if (classIds.length) {
        const { data: studs } = await supabase
          .from('students')
          .select('*, classes(name), profiles(full_name, email, city)')
          .in('class_id', classIds)
          .order('created_at', { ascending: false })
        setStudents(studs || [])
                const { data: per } = await supabase
          .from('lia_periods').select('*').in('class_id', classIds).order('sequence')
        setPerioder(per || [])

        const periodIds = (per || []).map(p => p.id)
        if (periodIds.length) {
          const { data: pl } = await supabase
            .from('placements')
            .select('id, student_id, lia_period_id, status, companies(company_name)')
            .in('lia_period_id', periodIds)
          setPlaceringar(pl || [])
        } else {
          setPlaceringar([])
        }
      } else {
        setStudents([])
      }

      setLoading(false)
    }
    load()
  }, [current?.id])
  async function laggTill(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    setKlart('')

    const res = await fetch('/api/lagg-till-student', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ namn: nyNamn, email: nyEpost, city: nyOrt, classId: nyKlass }),
    })
    const data = await res.json()
    setBusy(false)

    if (!res.ok) { setError(data.error || 'Kunde inte lägga till studenten'); return }

    setKlart(data.varning || `Inbjudan skickad till ${data.email}`)
    setNyNamn(''); setNyEpost(''); setNyOrt('')
    setVisaForm(false)
    window.location.reload()
  }
  function weeksUntil(dateStr: string | null): number | null {
    if (!dateStr) return null
    return Math.round((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 7))
  }

  const visible = students
    .filter(s => filter === 'alla' || s.status === filter)
    .filter(s => {
      if (!search.trim()) return true
      const q = search.toLowerCase()
      return (s.profiles?.full_name || '').toLowerCase().includes(q)
          || (s.profiles?.email || '').toLowerCase().includes(q)
          || (s.program || '').toLowerCase().includes(q)
    })

  if (loading) return (
    <div className="min-h-screen bg-paper flex items-center justify-center">
      <p className="text-muted text-sm">Laddar</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-paper text-text flex flex-col lg:flex-row">
            <Sidebar role="education" name={profile?.full_name} subtitle={education?.program_name} />

      <main className="flex-1 p-5 sm:p-8 max-w-6xl">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-1">
          <h1 className="text-2xl sm:text-3xl">Studenter</h1>
          <button
            onClick={() => { setVisaForm(!visaForm); setError(''); setKlart('') }}
            className="bg-accent text-white px-5 py-2.5 rounded-full text-sm font-medium hover:opacity-85 transition"
          >
            {visaForm ? 'Avbryt' : 'Lägg till student'}
          </button>
        </div>
        <p className="text-muted text-sm mb-6">
          {students.length} {students.length === 1 ? 'student' : 'studenter'} anslutna
        </p>

        {error && (
          <p className="bg-alert/10 border border-alert/25 text-alert text-sm rounded-lg px-4 py-3 mb-5">{error}</p>
        )}
        {klart && (
          <p className="bg-ok/10 border border-ok/25 text-ok text-sm rounded-lg px-4 py-3 mb-5">{klart}</p>
        )}

        {visaForm && (
          <form onSubmit={laggTill} className="bg-card border border-line rounded-xl p-6 mb-6 space-y-4">
            <p className="text-muted text-sm">
              Studenten får ett mejl med en länk för att välja lösenord. Du ser dem
              i listan direkt, även innan de loggat in.
            </p>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm mb-1.5">Namn</label>
                <input value={nyNamn} onChange={ev => setNyNamn(ev.target.value)} required placeholder="Anna Svensson" className="w-full bg-paper border border-line rounded-lg px-4 py-2.5 text-sm outline-none focus:border-text/40 transition" />
              </div>
              <div>
                <label className="block text-sm mb-1.5">E-post</label>
                <input type="email" value={nyEpost} onChange={ev => setNyEpost(ev.target.value)} required placeholder="anna@mail.se" className="w-full bg-paper border border-line rounded-lg px-4 py-2.5 text-sm outline-none focus:border-text/40 transition" />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm mb-1.5">Klass</label>
                <select value={nyKlass} onChange={ev => setNyKlass(ev.target.value)} required className="w-full bg-paper border border-line rounded-lg px-4 py-2.5 text-sm outline-none focus:border-text/40 transition">
                  {klasser.map(k => <option key={k.id} value={k.id}>{k.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm mb-1.5">Ort</label>
                <input value={nyOrt} onChange={ev => setNyOrt(ev.target.value)} placeholder="Malmö" className="w-full bg-paper border border-line rounded-lg px-4 py-2.5 text-sm outline-none focus:border-text/40 transition" />
                <p className="text-muted text-xs mt-1.5">Studenten kan ändra själv senare.</p>
              </div>
            </div>

            <button type="submit" disabled={busy || !klasser.length} className="bg-text text-paper rounded-full px-6 py-2.5 text-sm font-medium hover:opacity-85 transition disabled:opacity-40">
              {busy ? 'Lägger till' : 'Lägg till och skicka inbjudan'}
            </button>

            {!klasser.length && (
              <p className="text-muted text-sm">
                Lägg upp en klass under Planering först.
              </p>
            )}
          </form>
        )}

        <div className="flex flex-wrap gap-3 items-center mb-5">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Sök namn, e-post eller program"
            className="bg-card border border-line rounded-lg px-4 py-2.5 text-sm w-full sm:w-72 outline-none focus:border-text/40 transition"
          />
          <div className="flex flex-wrap gap-1.5">
            {filters.map(f => {
              const n = f.value === 'alla'
                ? students.length
                : students.filter(s => s.status === f.value).length
              return (
                <button
                  key={f.value}
                  onClick={() => setFilter(f.value)}
                  className={`px-3.5 py-2 rounded-full text-sm transition ${
                    filter === f.value
                      ? 'bg-text text-paper'
                      : 'bg-card border border-line text-muted hover:border-text/30'
                  }`}
                >
                  {f.label} {n > 0 && <span className="opacity-50">{n}</span>}
                </button>
              )
            })}
          </div>
        </div>

        {visible.length === 0 ? (
          <div className="bg-card border border-line rounded-xl p-12 text-center">
            <p className="mb-1">
              {students.length === 0 ? 'Inga studenter än' : 'Inga träffar'}
            </p>
            <p className="text-muted text-sm">
              {students.length === 0
                ? 'Studenter syns här så fort de skapat sin profil.'
                : 'Prova ett annat filter eller en annan sökning.'}
            </p>
          </div>
        ) : (
          <>
                        <div className="hidden md:block bg-card border border-line rounded-xl overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-line">
                    <th className="text-left px-5 py-3.5 text-xs font-medium text-muted">Student</th>
                    <th className="text-left px-5 py-3.5 text-xs font-medium text-muted">Klass</th>
                    {perioder.map(p => (
                      <th key={p.id} className="text-left px-5 py-3.5 text-xs font-medium text-muted whitespace-nowrap">
                        {p.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visible.map(s => (
                    <tr key={s.id} className="border-b border-line last:border-0 hover:bg-paper/60 transition">
                      <td className="px-5 py-4">
                        <p className="text-sm font-medium">{s.profiles?.full_name}</p>
                        <p className="text-muted text-xs">{s.profiles?.city || 'Ort saknas'}</p>
                      </td>
                      <td className="px-5 py-4 text-sm text-muted whitespace-nowrap">
                        {s.classes?.name || '—'}
                      </td>
                      {perioder.map(p => {
                        const pl = placeringar.find(
                          x => x.student_id === s.id && x.lia_period_id === p.id
                        )
                        if (!pl) return (
                          <td key={p.id} className="px-5 py-4 text-muted text-sm">—</td>
                        )
                        const w = weeksUntil(p.start_date)
                        const urgent = pl.status === 'söker' && w !== null && w <= 8
                        return (
                          <td key={p.id} className="px-5 py-4">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap ${statusStyle[pl.status] || 'bg-muted/10 text-muted'}`}>
                              {pl.status}
                            </span>
                            {pl.companies?.company_name && (
                              <p className="text-muted text-xs mt-1">{pl.companies.company_name}</p>
                            )}
                            {urgent && (
                              <p className="text-alert text-xs mt-1">{w} v kvar</p>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="md:hidden space-y-2.5">
              {visible.map(s => {
                const w = weeksUntil(s.lia_period_start)
                const urgent = s.status === 'söker' && w !== null && w <= 8
                return (
                  <div key={s.id} className="bg-card border border-line rounded-xl p-4">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{s.profiles?.full_name}</p>
                        <p className="text-muted text-xs truncate">{s.profiles?.email}</p>
                      </div>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium shrink-0 ${statusStyle[s.status] || ''}`}>
                        {s.status}
                      </span>
                    </div>
                    <p className="text-muted text-xs">
                      {s.program || 'Program saknas'}
                      {s.profiles?.city ? `, ${s.profiles.city}` : ''}
                    </p>
                    {s.lia_period_start && (
                      <p className="text-muted text-xs mt-1">
                        {s.lia_period_start} – {s.lia_period_end}
                      </p>
                    )}
                    {urgent && (
                      <p className="text-alert text-xs mt-2">
                        {w} {w === 1 ? 'vecka' : 'veckor'} kvar, ingen plats
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}
      </main>
    </div>
  )
}