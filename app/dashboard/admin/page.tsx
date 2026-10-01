'use client'
import { useEffect, useState } from 'react'
import { createClient } from '../../lib/supabase'
import { useRouter } from 'next/navigation'
import AdminSidebar from '../../components/AdminSidebar'

export default function AdminOversikt() {
  const [profile, setProfile] = useState<any>(null)
  const [data, setData]       = useState<any>({})
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

      if (!prof?.is_admin) { setLoading(false); return }

      const [skolor, edus, studs, plac, avtal, utv, foretag] = await Promise.all([
        supabase.from('schools').select('id, status, created_at'),
        supabase.from('educations').select('id, status'),
        supabase.from('students').select('id, created_at'),
        supabase.from('placements').select('id, status'),
        supabase.from('agreements').select('id, all_signed'),
        supabase.from('evaluations').select('id, status'),
        supabase.from('companies').select('id, claimed'),
      ])

      setData({
        skolor:  skolor.data  || [],
        edus:    edus.data    || [],
        studs:   studs.data   || [],
        plac:    plac.data    || [],
        avtal:   avtal.data   || [],
        utv:     utv.data     || [],
        foretag: foretag.data || [],
      })

      setLoading(false)
    }
    load()
  }, [])

  if (loading) return (
    <div className="min-h-screen bg-paper flex items-center justify-center">
      <p className="text-muted text-sm">Laddar</p>
    </div>
  )

  if (!profile?.is_admin) return (
    <div className="min-h-screen bg-paper flex items-center justify-center p-4">
      <div className="bg-card border border-line rounded-xl p-8 max-w-md text-center text-text">
        <p className="mb-1">Ingen åtkomst</p>
        <p className="text-muted text-sm mb-5">
          Den här delen är endast för plattformsadministratörer.
        </p>
        <a href="/dashboard/education" className="inline-block bg-text text-paper rounded-full px-6 py-2.5 text-sm font-medium">
          Till din dashboard
        </a>
      </div>
    </div>
  )

  const godkanda  = data.skolor.filter((s: any) => s.status === 'godkänd').length
  const vantar    = data.skolor.filter((s: any) => s.status === 'väntar').length
  const medPlats  = data.plac.filter((p: any) => ['matchad', 'avtal', 'aktiv', 'klar'].includes(p.status)).length
  const klara     = data.plac.filter((p: any) => p.status === 'klar').length
  const signerade = data.avtal.filter((a: any) => a.all_signed).length
  const besvarade = data.utv.filter((e: any) => e.status === 'besvarat').length
  const medKonto  = data.foretag.filter((c: any) => c.claimed).length

  const placgrad = data.plac.length ? Math.round((medPlats / data.plac.length) * 100) : 0

  return (
    <div className="min-h-screen bg-paper text-text flex flex-col lg:flex-row">
      <AdminSidebar name={profile?.full_name} />

      <main className="flex-1 p-5 sm:p-8 max-w-4xl">
        <h1 className="text-2xl sm:text-3xl mb-1">Översikt</h1>
        <p className="text-muted text-sm mb-7">
          Hela plattformen, alla anordnare sammanräknade.
        </p>

        {vantar > 0 && (
          <a href="/dashboard/admin/anordnare"
            className="block bg-warn/8 border border-warn/25 rounded-xl px-5 py-4 mb-6 hover:border-warn/40 transition">
            <p className="text-sm">
              <strong>{vantar} {vantar === 1 ? 'anordnare väntar' : 'anordnare väntar'}</strong> på godkännande.
              <span className="text-muted"> Klicka för att hantera.</span>
            </p>
          </a>
        )}

        <section className="bg-card border border-line rounded-xl p-6 mb-4">
          <h2 className="text-base mb-5">Anslutning</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-5">
            {[
              { n: godkanda,            label: 'anordnare' },
              { n: data.edus.length,    label: 'utbildningar' },
              { n: data.studs.length,   label: 'studerande' },
              { n: data.foretag.length, label: 'företag' },
            ].map((s, i) => (
              <div key={i}>
                <p className="font-display text-3xl font-extrabold">{s.n}</p>
                <p className="text-muted text-sm mt-1 leading-snug">{s.label}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-card border border-line rounded-xl p-6 mb-4">
          <h2 className="text-base mb-5">Aktivitet</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-5">
            {[
              { n: data.plac.length, label: 'LIA-perioder totalt' },
              { n: medPlats,         label: 'med plats' },
              { n: signerade,        label: 'signerade avtal' },
              { n: besvarade,        label: 'utvärderingar inne' },
            ].map((s, i) => (
              <div key={i}>
                <p className="font-display text-3xl font-extrabold">{s.n}</p>
                <p className="text-muted text-sm mt-1 leading-snug">{s.label}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-5 mt-6 pt-6 border-t border-line">
            {[
              { n: placgrad + '%',     label: 'placeringsgrad' },
              { n: klara,              label: 'slutförda perioder' },
              { n: medKonto,           label: 'företag med konto' },
              { n: data.skolor.length, label: 'anordnare totalt' },
            ].map((s, i) => (
              <div key={i}>
                <p className="font-display text-3xl font-extrabold">{s.n}</p>
                <p className="text-muted text-sm mt-1 leading-snug">{s.label}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-card border border-line rounded-xl p-6">
          <h2 className="text-base mb-1">Att göra</h2>
          <p className="text-muted text-sm mb-4">
            Det som kräver din uppmärksamhet som plattformsägare.
          </p>

          {vantar === 0 ? (
            <p className="text-muted text-sm">Ingenting väntar just nu.</p>
          ) : (
            <ul className="space-y-2">
              <li className="text-sm">
                {vantar} {vantar === 1 ? 'anordnare behöver' : 'anordnare behöver'} godkännas.
                Teckna biträdesavtal först.
              </li>
            </ul>
          )}
        </section>
      </main>
    </div>
  )
}
