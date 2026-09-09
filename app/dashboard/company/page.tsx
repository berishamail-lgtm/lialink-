'use client'
import { useEffect, useState } from 'react'
import { createClient } from '../../lib/supabase'
import { useRouter } from 'next/navigation'

export default function CompanyDashboard() {
  const [profile, setProfile]   = useState<any>(null)
  const [company, setCompany]   = useState<any>(null)
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

      const { data: comp } = await supabase
        .from('companies')
        .select('*')
        .eq('user_id', user.id)
        .single()
      setCompany(comp)

      if (comp) {
        const { data: m } = await supabase
          .from('matches')
          .select('*, students(*, profiles(full_name, email, city))')
          .eq('company_id', comp.id)
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
          <span className="text-white/40 text-sm">{company?.company_name}</span>
          <button onClick={handleLogout} className="text-sm text-white/40 hover:text-white transition">
            Logga ut
          </button>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-8 py-10">
        {/* Header */}
        <div className="mb-8">
          <p className="text-green-400 text-xs font-bold uppercase tracking-widest mb-2">Arbetsgivare</p>
          <h1 className="text-3xl font-bold">Välkommen, {profile?.full_name} 👋</h1>
          <p className="text-white/40 mt-1 text-sm">
            {company ? `${company.company_name} · ${company.city}` : 'Fyll i företagsprofilen för att komma igång'}
          </p>
        </div>

        {/* Statistikkort */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: 'LIA-platser totalt',  value: company?.spots_total     || 0, color: 'text-white' },
            { label: 'Lediga platser',       value: company?.spots_available || 0, color: 'text-green-400' },
            { label: 'Matchade kandidater',  value: matches.length,               color: 'text-blue-400' },
          ].map((stat, i) => (
            <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <div className={`text-3xl font-bold ${stat.color}`}>{stat.value}</div>
              <div className="text-white/40 text-sm mt-1">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Profil saknas */}
        {!company && (
          <div className="bg-green-400/10 border border-green-400/20 rounded-2xl p-6 mb-6">
            <h2 className="font-bold mb-1">Fyll i företagsprofilen</h2>
            <p className="text-white/50 text-sm mb-4">
              Du behöver fylla i er företagsprofil för att matchas med studenter.
            </p>
            <button
              onClick={() => router.push('/dashboard/company/profil')}
              className="bg-green-500 text-white px-6 py-2 rounded-full text-sm font-bold hover:opacity-80 transition"
            >
              Fyll i profil →
            </button>
          </div>
        )}

        {/* Kandidatlista */}
        <div>
          <h2 className="font-bold mb-4">
            Matchade kandidater
            <span className="ml-2 text-white/30 font-normal text-sm">({matches.length} st)</span>
          </h2>

          {matches.length === 0 ? (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-10 text-center">
              <div className="text-4xl mb-3">👥</div>
              <h3 className="font-bold mb-1">Inga kandidater ännu</h3>
              <p className="text-white/40 text-sm">
                {company
                  ? 'Matchningsalgoritmen kör automatiskt när studenter registrerar sig.'
                  : 'Fyll i företagsprofilen först så kan vi matcha er med rätt studenter.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {matches.map(match => (
                <div key={match.id} className="bg-white/5 border border-white/10 rounded-2xl p-5 flex items-center justify-between hover:bg-white/8 transition">
                  <div>
                    <div className="font-semibold">
                      {match.students?.profiles?.full_name}
                    </div>
                    <div className="text-white/40 text-sm mt-1">
                      {match.students?.program} · {match.students?.profiles?.city}
                    </div>
                    <div className="flex gap-2 mt-2 flex-wrap">
                      {(match.students?.skills || []).map((skill: string) => (
                        <span key={skill} className="bg-white/10 text-white/60 px-2 py-0.5 rounded text-xs">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="text-right ml-4">
                    <div className="text-2xl font-bold text-green-400">{match.score}%</div>
                    <div className="text-white/30 text-xs mb-2">matchning</div>
                    <button className="bg-green-500 text-white px-4 py-1.5 rounded-full text-xs font-bold hover:opacity-80 transition">
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