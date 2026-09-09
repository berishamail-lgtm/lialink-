'use client'
import { useEffect, useState } from 'react'
import { createClient } from '../../lib/supabase'
import { useRouter } from 'next/navigation'

export default function EducationDashboard() {
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    async function getProfile() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      setProfile(data)
      setLoading(false)
    }
    getProfile()
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
          <span className="text-white/50 text-sm">{profile?.email}</span>
          <button
            onClick={handleLogout}
            className="text-sm text-white/50 hover:text-white transition"
          >
            Logga ut
          </button>
        </div>
      </nav>

      {/* Innehåll */}
      <div className="max-w-6xl mx-auto px-8 py-12">
        <div className="mb-10">
          <p className="text-[#e8420a] text-sm font-bold uppercase tracking-widest mb-2">
            Utbildningsledare
          </p>
          <h1 className="text-4xl font-bold">
            Välkommen, {profile?.full_name || 'Utbildningsledare'} 👋
          </h1>
          <p className="text-white/40 mt-2">
            Här ser du status för alla dina studenter och LIA-placeringar.
          </p>
        </div>

        {/* Statistikkort */}
        <div className="grid grid-cols-4 gap-4 mb-10">
          {[
            { label: 'Totalt studenter', value: '0', color: 'text-white' },
            { label: 'Har LIA-plats',    value: '0', color: 'text-green-400' },
            { label: 'Söker fortfarande',value: '0', color: 'text-yellow-400' },
            { label: 'Avtal signerade',  value: '0', color: 'text-blue-400' },
          ].map((stat, i) => (
            <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <div className={`text-3xl font-bold ${stat.color}`}>{stat.value}</div>
              <div className="text-white/40 text-sm mt-1">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Studentlista platshållare */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
          <div className="text-4xl mb-4">🎓</div>
          <h2 className="text-xl font-bold mb-2">Inga studenter ännu</h2>
          <p className="text-white/40 text-sm">
            När studenter registrerar sig och kopplar sig till din utbildning
            visas de här med realtidsstatus.
          </p>
        </div>
      </div>
    </div>
  )
}