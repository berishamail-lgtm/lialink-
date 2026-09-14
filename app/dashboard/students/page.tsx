'use client'
import { useEffect, useState } from 'react'
import { createClient } from '../../lib/supabase'
import { useRouter } from 'next/navigation'
import Sidebar from '../../components/Sidebar'

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
  const [profile, setProfile]     = useState<any>(null)
  const [education, setEducation] = useState<any>(null)
  const [students, setStudents]   = useState<any[]>([])
  const [filter, setFilter]       = useState('alla')
  const [search, setSearch]       = useState('')
  const [loading, setLoading]     = useState(true)
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
        .from('students')
        .select('*, profiles(full_name, email, city)')
        .order('created_at', { ascending: false })
      setStudents(studs || [])

      setLoading(false)
    }
    load()
  }, [])

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
        <h1 className="text-2xl sm:text-3xl mb-1">Studenter</h1>
        <p className="text-muted text-sm mb-7">
          {students.length} {students.length === 1 ? 'student' : 'studenter'} anslutna
        </p>

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
            <div className="hidden md:block bg-card border border-line rounded-xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-line">
                    {['Student', 'Program', 'Ort', 'LIA-period', 'Status'].map(h => (
                      <th key={h} className="text-left px-5 py-3.5 text-xs font-medium text-muted">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visible.map(s => {
                    const w = weeksUntil(s.lia_period_start)
                    const urgent = s.status === 'söker' && w !== null && w <= 8
                    return (
                      <tr key={s.id} className="border-b border-line last:border-0 hover:bg-paper/60 transition">
                        <td className="px-5 py-4">
                          <p className="text-sm font-medium">{s.profiles?.full_name}</p>
                          <p className="text-muted text-xs">{s.profiles?.email}</p>
                        </td>
                        <td className="px-5 py-4 text-sm text-muted">{s.program || '—'}</td>
                        <td className="px-5 py-4 text-sm text-muted">{s.profiles?.city || '—'}</td>
                        <td className="px-5 py-4 text-sm text-muted">
                          {s.lia_period_start ? (
                            <>
                              {s.lia_period_start} – {s.lia_period_end}
                              {urgent && (
                                <span className="block text-alert text-xs mt-0.5">
                                  {w} {w === 1 ? 'vecka' : 'veckor'} kvar, ingen plats
                                </span>
                              )}
                            </>
                          ) : '—'}
                        </td>
                        <td className="px-5 py-4">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusStyle[s.status] || ''}`}>
                            {s.status}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
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