'use client'
import { useEffect, useState } from 'react'
import { createClient } from '../../lib/supabase'
import { useRouter } from 'next/navigation'
import Sidebar from '../../components/Sidebar'

export default function KontoPage() {
  const [profile, setProfile]   = useState<any>(null)
  const [subtitle, setSubtitle] = useState('')
  const [loading, setLoading]   = useState(true)

  const [steg, setSteg]         = useState(0)
  const [bedomning, setBedomning] = useState<any>(null)
  const [bekraftat, setBekraftat] = useState('')
  const [reason, setReason]     = useState('')
  const [busy, setBusy]         = useState(false)
  const [error, setError]       = useState('')

  const supabase = createClient()
  const router   = useRouter()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: prof } = await supabase
        .from('profiles').select('*').eq('id', user.id).single()
      setProfile(prof)

      if (prof?.role === 'education') {
        const { data } = await supabase
          .from('educations').select('program_name').eq('user_id', user.id).maybeSingle()
        setSubtitle(data?.program_name || '')
      } else if (prof?.role === 'company') {
        const { data } = await supabase
          .from('companies').select('company_name').eq('user_id', user.id).maybeSingle()
        setSubtitle(data?.company_name || '')
      }

      setLoading(false)
    }
    load()
  }, [])

  async function forhandsgranska() {
    setBusy(true)
    setError('')
    const res = await fetch(`/api/radera-konto?userId=${profile.id}&role=${profile.role}`)
    const data = await res.json()
    setBusy(false)
    if (!res.ok) { setError(data.error || 'Något gick fel'); return }
    setBedomning(data)
    setSteg(1)
  }

  async function radera() {
    setBusy(true)
    setError('')
    const res = await fetch('/api/radera-konto', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: profile.id, role: profile.role, reason }),
    })
    const data = await res.json()
    setBusy(false)
    if (!res.ok) { setError(data.error || 'Något gick fel'); return }

    await supabase.auth.signOut()
    router.push('/')
  }

  const field = 'w-full bg-paper border border-line rounded-lg px-4 py-2.5 text-sm outline-none focus:border-text/40 transition'

  if (loading) return (
    <div className="min-h-screen bg-paper flex items-center justify-center">
      <p className="text-muted text-sm">Laddar</p>
    </div>
  )

  const anonym = bedomning?.metod === 'anonymiserad'

  return (
    <div className="min-h-screen bg-paper text-text flex flex-col lg:flex-row">
      <Sidebar role={profile?.role} name={profile?.full_name} subtitle={subtitle} />

      <main className="flex-1 p-5 sm:p-8 max-w-2xl">
        <h1 className="text-2xl sm:text-3xl mb-1">Ditt konto</h1>
        <p className="text-muted text-sm mb-7">
          {profile?.email}
        </p>

        {error && (
          <p className="bg-alert/10 border border-alert/25 text-alert text-sm rounded-lg px-4 py-3 mb-5">
            {error}
          </p>
        )}

        <section className="bg-card border border-line rounded-xl p-6">
          <h2 className="text-base mb-1">Ta bort kontot</h2>
          <p className="text-muted text-sm leading-relaxed mb-5">
            Du kan när som helst begära att ditt konto tas bort. Vi visar först
            exakt vad som händer med dina uppgifter.
          </p>

          {steg === 0 && (
            <button
              onClick={forhandsgranska}
              disabled={busy}
              className="border border-alert/40 text-alert rounded-full px-5 py-2.5 text-sm font-medium hover:bg-alert/5 transition disabled:opacity-40"
            >
              {busy ? 'Kontrollerar' : 'Ta bort mitt konto'}
            </button>
          )}

          {steg === 1 && bedomning && (
            <div className="border-t border-line pt-5 space-y-5">
              {anonym ? (
                <div>
                  <p className="text-sm font-medium mb-2">
                    Dina personuppgifter tas bort, men vissa handlingar sparas
                  </p>
                  <p className="text-muted text-sm leading-relaxed mb-3">
                    Ditt konto har {bedomning.skal.join(' och ')}. Ett signerat
                    LIA-avtal är bindande mellan tre parter och kan inte raderas
                    ensidigt. Ditt namn ersätts därför med Borttagen användare
                    i de handlingarna.
                  </p>
                  <p className="text-sm mb-1">Detta tas bort direkt:</p>
                  <ul className="text-muted text-sm space-y-0.5 mb-3">
                    <li>Inloggningen och e-postadressen</li>
                    <li>CV och personligt brev</li>
                    <li>Presentation, kompetenser och ort</li>
                  </ul>
                  <p className="text-sm mb-1">Detta sparas, utan ditt namn:</p>
                  <ul className="text-muted text-sm space-y-0.5">
                    <li>Signerade LIA-avtal</li>
                    <li>Utvärderingar från handledare</li>
                  </ul>
                </div>
              ) : (
                <div>
                  <p className="text-sm font-medium mb-2">
                    Allt tas bort permanent
                  </p>
                  <p className="text-muted text-sm leading-relaxed">
                    Ditt konto har inga signerade avtal, så vi raderar samtliga
                    uppgifter. Det går inte att ångra.
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm mb-1.5">
                  Varför tar du bort kontot? <span className="text-muted">Frivilligt</span>
                </label>
                <input value={reason} onChange={e => setReason(e.target.value)} placeholder="Hjälper oss bli bättre" className={field} />
              </div>

              <div>
                <label className="block text-sm mb-1.5">
                  Skriv RADERA för att bekräfta
                </label>
                <input value={bekraftat} onChange={e => setBekraftat(e.target.value)} placeholder="RADERA" className={field} />
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={radera}
                  disabled={busy || bekraftat !== 'RADERA'}
                  className="bg-alert text-white rounded-full px-5 py-2.5 text-sm font-medium hover:opacity-85 transition disabled:opacity-25"
                >
                  {busy ? 'Tar bort' : anonym ? 'Ta bort mina uppgifter' : 'Radera allt permanent'}
                </button>
                <button
                  onClick={() => { setSteg(0); setBekraftat(''); setBedomning(null) }}
                  className="text-muted text-sm px-4"
                >
                  Avbryt
                </button>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}