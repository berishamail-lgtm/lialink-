'use client'
import { useEffect, useState } from 'react'
import { createClient } from '../../lib/supabase'
import { useRouter } from 'next/navigation'

export default function StudentDashboard() {
  const [profile, setProfile]   = useState<any>(null)
  const [student, setStudent]   = useState<any>(null)
  const [matches, setMatches]   = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
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

      const { data: stud } = await supabase
        .from('students')
        .select('*')
        .eq('user_id', user.id)
        .single()
      setStudent(stud)

      if (stud) {
        const { data: m } = await supabase
          .from('matches')
          .select('*, companies(user_id, company_name, sector, city, description)')
          .eq('student_id', stud.id)
          .order('score', { ascending: false })
        setMatches(m || [])
      }

      setLoading(false)
    }
    load()
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const steps = [
    { label: 'Skapa profil',    done: !!student },
    { label: 'Få matchningar',  done: matches.length > 0 },
    { label: 'Signera avtal',   done: student?.status === 'avtal' || student?.status === 'aktiv' || student?.status === 'klar' },
    { label: 'Starta LIA',      done: student?.status === 'aktiv' || student?.status === 'klar' },
  ]

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
        <div className="flex items-center gap-4">
          <span className="text-white/40 text-sm">{profile?.email}</span>
          <button onClick={handleLogout} className="text-sm text-white/40 hover:text-white transition">
            Logga ut
          </button>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-8 py-10">
        {/* Header */}
        <div className="mb-8">
          <p className="text-blue-400 text-xs font-bold uppercase tracking-widest mb-2">Student</p>
          <h1 className="text-3xl font-bold">Välkommen, {profile?.full_name} 👋</h1>
          <p className="text-white/40 mt-1 text-sm">
            {student ? `${student.program} · ${profile?.city || ''}` : 'Fyll i din profil för att komma igång'}
          </p>
        </div>

        {/* LIA-process steg */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-6">
          <h2 className="font-bold mb-4 text-sm uppercase tracking-wider text-white/40">Din LIA-process</h2>
          <div className="flex items-center gap-0">
            {steps.map((step, i) => (
              <div key={i} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold mb-2 ${
                    step.done ? 'bg-green-400 text-black' : 'bg-white/10 text-white/40'
                  }`}>
                    {step.done ? '✓' : i + 1}
                  </div>
                  <span className="text-xs text-white/50 text-center">{step.label}</span>
                </div>
                {i < steps.length - 1 && (
                  <div className={`h-px flex-1 mb-6 ${steps[i+1].done ? 'bg-green-400' : 'bg-white/10'}`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Profil saknas */}
        {!student && (
          <div className="bg-blue-400/10 border border-blue-400/20 rounded-2xl p-6 mb-6">
            <h2 className="font-bold mb-1">Fyll i din studentprofil</h2>
            <p className="text-white/50 text-sm mb-4">Du behöver fylla i din profil för att kunna matchas med företag.</p>
            <button
              onClick={() => router.push('/dashboard/student/profil')}
              className="bg-blue-500 text-white px-6 py-2 rounded-full text-sm font-bold hover:opacity-80 transition"
            >
              Fyll i profil →
            </button>
          </div>
        )}

        {/* Matchningar */}
        <div className="mb-6">
          <h2 className="font-bold mb-4">
            Dina matchningar
            <span className="ml-2 text-white/30 font-normal text-sm">({matches.length} st)</span>
          </h2>

          {matches.length === 0 ? (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-10 text-center">
              <div className="text-4xl mb-3">🔍</div>
              <h3 className="font-bold mb-1">Inga matchningar ännu</h3>
              <p className="text-white/40 text-sm">
                {student
                  ? 'Matchningsalgoritmen körs när företag registrerar sig. Du får ett mail när du har en matchning.'
                  : 'Fyll i din profil först så kan vi matcha dig med rätt företag.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {matches.map(match => (
                <div key={match.id} className="bg-white/5 border border-white/10 rounded-2xl p-5 flex items-center justify-between hover:bg-white/8 transition">
                  <div>
                    <div className="font-semibold">{match.companies?.company_name}</div>
                    <div className="text-white/40 text-sm mt-1">
                      {match.companies?.sector} · {match.companies?.city}
                    </div>
                    <div className="text-white/30 text-xs mt-1">{match.companies?.description}</div>
                  </div>
                  <div className="text-right ml-4">
                    <div className="text-2xl font-bold text-green-400">{match.score}%</div>
                    <div className="text-white/30 text-xs">matchning</div>
                    <span className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-bold ${
                      match.status === 'intresserad' ? 'bg-green-400/15 text-green-400' :
                      match.status === 'avvisad'     ? 'bg-red-400/15 text-red-400' :
                      'bg-white/10 text-white/50'
                    }`}>
                      {match.status}
                    </span>
                    <button
  onClick={() => router.push('/dashboard/messages?to=' + match.companies?.user_id + '&name=' + match.companies?.company_name)}
  className="mt-2 bg-white text-[#0f0e0d] px-3 py-1.5 rounded-full text-xs font-bold hover:opacity-80 transition block w-full text-center"
>
  Kontakta →
</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}