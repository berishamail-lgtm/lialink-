'use client'
import { useEffect, useState } from 'react'
import { createClient } from '../../lib/supabase'
import { useRouter } from 'next/navigation'

export default function EducationDashboard() {
  const [profile, setProfile]     = useState<any>(null)
  const [education, setEducation] = useState<any>(null)
  const [students, setStudents]   = useState<any[]>([])
  const [filter, setFilter]       = useState('alla')
  const [loading, setLoading]     = useState(true)
  const supabase = createClient()
  const router   = useRouter()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: prof } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
      setProfile(prof)

      const { data: edu } = await supabase
        .from('educations')
        .select('*')
        .eq('user_id', user.id)
        .single()
      setEducation(edu)

      const { data: studs } = await supabase
        .from('students')
        .select('*, profiles(full_name, email, city)')
      setStudents(studs || [])

      setLoading(false)
    }
    load()
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }
async function runMatching() {
  const res = await fetch('/api/match', { method: 'POST' })
  const data = await res.json()
  alert(data.message)
  window.location.reload()
}
  const filtered = filter === 'alla'
    ? students
    : students.filter(s => s.status === filter)

  const counts = {
    total:   students.length,
    matchad: students.filter(s => s.status === 'matchad').length,
    soker:   students.filter(s => s.status === 'söker').length,
    avtal:   students.filter(s => s.status === 'avtal').length,
  }

  if (loading) return (
    <div className="min-h-screen bg-[#0f0e0d] flex items-center justify-center">
      <p className="text-white">Laddar…</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#0f0e0d] text-white">
      {/* Navbar */}
      <nav className="border-b border-white/10 px-8 py-4 flex items-center justify-between">
        <div className="font-bold text-xl">
          LIA<span className="text-[#e8420a]">link</span>
        </div>
        <div className="flex items-center gap-6">
          <span className="text-white/40 text-sm">
            {education?.school_name} · {education?.program_name}
          </span>
          <button onClick={handleLogout} className="text-sm text-white/40 hover:text-white transition">
            Logga ut
          </button>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-8 py-10">
        {/* Header */}
        <div className="mb-8">
          <p className="text-[#e8420a] text-xs font-bold uppercase tracking-widest mb-2">
            Utbildningsledare
          </p>
          <h1 className="text-3xl font-bold">
            Välkommen, {profile?.full_name} 👋
          </h1>
          <button
  onClick={runMatching}
  className="mt-4 bg-[#e8420a] text-white px-6 py-2 rounded-full text-sm font-bold hover:opacity-80 transition"
>
  🔄 Kör matchning
</button>
          <p className="text-white/40 mt-1 text-sm">
            {education?.city} · {education?.program_name}
          </p>
        </div>

        {/* Statistikkort */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Totalt studenter', value: counts.total,   color: 'text-white',        bg: 'bg-white/5' },
            { label: 'Har LIA-plats',    value: counts.matchad, color: 'text-green-400',    bg: 'bg-green-400/5' },
            { label: 'Söker fortfarande',value: counts.soker,   color: 'text-yellow-400',   bg: 'bg-yellow-400/5' },
            { label: 'Avtal signerade',  value: counts.avtal,   color: 'text-blue-400',     bg: 'bg-blue-400/5' },
          ].map((stat, i) => (
            <div key={i} className={`${stat.bg} border border-white/10 rounded-2xl p-6`}>
              <div className={`text-3xl font-bold ${stat.color}`}>{stat.value}</div>
              <div className="text-white/40 text-sm mt-1">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Filter */}
        <div className="flex gap-2 mb-6">
          {[
            { value: 'alla',    label: 'Alla' },
            { value: 'söker',   label: '🟡 Söker' },
            { value: 'matchad', label: '🟢 Matchad' },
            { value: 'avtal',   label: '🔵 Avtal' },
            { value: 'aktiv',   label: '✅ Aktiv' },
            { value: 'klar',    label: '⭐ Klar' },
          ].map(f => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`px-4 py-2 rounded-full text-xs font-semibold transition ${
                filter === f.value
                  ? 'bg-white text-[#0f0e0d]'
                  : 'bg-white/5 text-white/50 hover:bg-white/10'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Studentlista */}
        {filtered.length === 0 ? (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-12 text-center">
            <div className="text-4xl mb-4">🎓</div>
            <h2 className="text-lg font-bold mb-2">Inga studenter ännu</h2>
            <p className="text-white/40 text-sm">
              När studenter registrerar sig visas de här med realtidsstatus.
            </p>
          </div>
        ) : (
          <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left px-6 py-4 text-xs font-bold text-white/40 uppercase tracking-wider">Student</th>
                  <th className="text-left px-6 py-4 text-xs font-bold text-white/40 uppercase tracking-wider">Program</th>
                  <th className="text-left px-6 py-4 text-xs font-bold text-white/40 uppercase tracking-wider">Stad</th>
                  <th className="text-left px-6 py-4 text-xs font-bold text-white/40 uppercase tracking-wider">Period</th>
                  <th className="text-left px-6 py-4 text-xs font-bold text-white/40 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((student, i) => (
                  <tr key={student.id} className={`border-b border-white/5 hover:bg-white/5 transition ${i % 2 === 0 ? '' : 'bg-white/2'}`}>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-sm">{student.profiles?.full_name}</div>
                      <div className="text-white/40 text-xs">{student.profiles?.email}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-white/60">{student.program}</td>
                    <td className="px-6 py-4 text-sm text-white/60">{student.profiles?.city}</td>
                    <td className="px-6 py-4 text-sm text-white/60">
                      {student.lia_period_start ? `${student.lia_period_start} → ${student.lia_period_end}` : '–'}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                        student.status === 'matchad' ? 'bg-green-400/15 text-green-400' :
                        student.status === 'avtal'   ? 'bg-blue-400/15 text-blue-400' :
                        student.status === 'aktiv'   ? 'bg-purple-400/15 text-purple-400' :
                        student.status === 'klar'    ? 'bg-white/15 text-white' :
                        'bg-yellow-400/15 text-yellow-400'
                      }`}>
                        {student.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}