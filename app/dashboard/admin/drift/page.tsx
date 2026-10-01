'use client'
import { useEffect, useState } from 'react'
import { createClient } from '../../../lib/supabase'
import { useRouter } from 'next/navigation'
import AdminSidebar from '../../../components/AdminSidebar'

export default function AdminDrift() {
  const [profile, setProfile]   = useState<any>(null)
  const [utskick, setUtskick]   = useState<any[]>([])
  const [forfr, setForfr]       = useState<any[]>([])
  const [avtal, setAvtal]       = useState<any[]>([])
  const [utv, setUtv]           = useState<any[]>([])
  const [radering, setRadering] = useState<any[]>([])
  const [loading, setLoading]   = useState(true)

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

      const [u, f, a, e, d] = await Promise.all([
        supabase.from('natverk_utskick').select('*').order('skickat_at', { ascending: false }).limit(30),
        supabase.from('intressesvar').select('skickat_at, svarat_at'),
        supabase.from('agreements').select('id, all_signed, status, created_at, notis_skickad_at, paminnelse_skickad_at'),
        supabase.from('evaluations').select('id, status, sent_at, reminded_at'),
        supabase.from('deletion_log').select('*').order('created_at', { ascending: false }).limit(10),
      ])

      setUtskick(u.data || [])
      setForfr(f.data || [])
      setAvtal(a.data || [])
      setUtv(e.data || [])
      setRadering(d.data || [])
      setLoading(false)
    }
    load()
  }, [])

  function idag(d?: string) {
    if (!d) return false
    return new Date(d).toDateString() === new Date().toDateString()
  }

  if (loading) return (
    <div className="min-h-screen bg-paper flex items-center justify-center">
      <p className="text-muted text-sm">Laddar</p>
    </div>
  )

  if (!profile?.is_admin) return (
    <div className="min-h-screen bg-paper flex items-center justify-center p-4">
      <div className="bg-card border border-line rounded-xl p-8 max-w-md text-center text-text">
        <p className="mb-1">Ingen åtkomst</p>
        <p className="text-muted text-sm">
          Den här delen är endast för plattformsadministratörer.
        </p>
      </div>
    </div>
  )

  // Mejl skickade idag, uppskattat
  const utskickIdag = utskick
    .filter(u => idag(u.skickat_at))
    .reduce((a, u) => a + (u.antal || 0), 0)

  const forfrIdag = forfr.filter(f => idag(f.skickat_at)).length
  const notisIdag = avtal.filter(a => idag(a.notis_skickad_at) || idag(a.paminnelse_skickad_at)).length
  const utvIdag   = utv.filter(e => idag(e.sent_at) || idag(e.reminded_at)).length

  const mejlIdag = utskickIdag + forfrIdag + notisIdag + utvIdag
  const andel    = Math.min(100, Math.round((mejlIdag / 100) * 100))

  const osignerade = avtal.filter(a => !a.all_signed && a.status !== 'avbrutet').length
  const obesvarade = utv.filter(e => e.status === 'skickat').length
  const osvarade   = forfr.filter(f => !f.svarat_at).length

  return (
    <div className="min-h-screen bg-paper text-text flex flex-col lg:flex-row">
      <AdminSidebar name={profile?.full_name} />

      <main className="flex-1 p-5 sm:p-8 max-w-4xl">
        <h1 className="text-2xl sm:text-3xl mb-1">Drift</h1>
        <p className="text-muted text-sm mb-7">
          Utskick, väntande ärenden och systemets tillstånd.
        </p>

        <section className="bg-card border border-line rounded-xl p-6 mb-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
            <h2 className="text-base">Mejl idag</h2>
            <span className={'text-sm ' + (mejlIdag > 80 ? 'text-alert' : mejlIdag > 50 ? 'text-warn' : 'text-muted')}>
              {mejlIdag} av 100
            </span>
          </div>
          <p className="text-muted text-sm mb-4">
            Gratisplanen hos Resend tillåter 100 mejl per dygn, delat av alla anordnare.
          </p>

          <div className="h-2 bg-line rounded-full overflow-hidden mb-5">
            <div
              className={'h-full rounded-full transition-[width] duration-500 ' +
                (mejlIdag > 80 ? 'bg-alert' : mejlIdag > 50 ? 'bg-warn' : 'bg-ok')}
              style={{ width: andel + '%' }}
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-5">
            {[
              { n: utskickIdag, label: 'nätverksutskick' },
              { n: forfrIdag,   label: 'intresseförfrågningar' },
              { n: notisIdag,   label: 'avtalsnotiser' },
              { n: utvIdag,     label: 'utvärderingar' },
            ].map((s, i) => (
              <div key={i}>
                <p className="font-display text-2xl font-extrabold">{s.n}</p>
                <p className="text-muted text-sm mt-1 leading-snug">{s.label}</p>
              </div>
            ))}
          </div>

          {mejlIdag > 80 && (
            <p className="bg-alert/10 border border-alert/25 text-alert text-sm rounded-lg px-4 py-3 mt-5">
              Nära dagsgränsen. Fler utskick idag riskerar att inte gå fram.
            </p>
          )}
        </section>

        <section className="bg-card border border-line rounded-xl p-6 mb-4">
          <h2 className="text-base mb-1">Väntar på svar</h2>
          <p className="text-muted text-sm mb-5">
            Ärenden som ligger öppna hos användarna, över hela plattformen.
          </p>
          <div className="grid grid-cols-3 gap-5">
            {[
              { n: osignerade, label: 'osignerade avtal' },
              { n: obesvarade, label: 'utvärderingar ute' },
              { n: osvarade,   label: 'intressesvar saknas' },
            ].map((s, i) => (
              <div key={i}>
                <p className="font-display text-3xl font-extrabold">{s.n}</p>
                <p className="text-muted text-sm mt-1 leading-snug">{s.label}</p>
              </div>
            ))}
          </div>
          <p className="text-muted text-sm mt-5">
            Påminnelser skickas automatiskt varje morgon för avtal äldre än tre dagar
            och utvärderingar äldre än en vecka.
          </p>
        </section>

        {utskick.length > 0 && (
          <section className="bg-card border border-line rounded-xl p-6 mb-4">
            <h2 className="text-base mb-1">Senaste utskicken</h2>
            <p className="text-muted text-sm mb-4">Över alla anordnare.</p>
            <div className="divide-y divide-line -mx-6">
              {utskick.slice(0, 8).map(u => (
                <div key={u.id} className="px-6 py-3 flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-sm truncate">{u.amne}</span>
                  <span className="text-muted text-sm shrink-0">
                    {u.antal} mottagare, {new Date(u.skickat_at).toLocaleDateString('sv-SE')}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="bg-card border border-line rounded-xl p-6">
          <h2 className="text-base mb-1">Raderade konton</h2>
          <p className="text-muted text-sm mb-4">
            Loggen innehåller inga personuppgifter, bara roll och metod.
          </p>
          {radering.length === 0 ? (
            <p className="text-muted text-sm">Inga raderingar än.</p>
          ) : (
            <div className="divide-y divide-line -mx-6">
              {radering.map(d => (
                <div key={d.id} className="px-6 py-3 flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-sm">{d.role} — {d.method}</span>
                  <span className="text-muted text-sm">
                    {new Date(d.created_at).toLocaleDateString('sv-SE')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
