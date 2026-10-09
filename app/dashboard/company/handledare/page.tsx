'use client'
import { useEffect, useState } from 'react'
import { createClient } from '../../../lib/supabase'
import { hamtaMittForetag } from '../../../lib/foretag'
import { useRouter } from 'next/navigation'
import Sidebar from '../../../components/Sidebar'

type Handledare = {
  id: string
  name: string
  email: string | null
  phone: string | null
  roll: string | null
  user_id: string | null
  aktiv: boolean
}

export default function HandledarePage() {
  const [profile, setProfile] = useState<any>(null)
  const [company, setCompany] = useState<any>(null)
  const [farAdm, setFarAdm]   = useState(false)
  const [minPost, setMinPost] = useState<string | null>(null)

  const [lista, setLista]     = useState<Handledare[]>([])
  const [antal, setAntal]     = useState<Record<string, number>>({})
  const [platser, setPlatser] = useState<Record<string, number>>({})
  const [inbjudna, setInbjudna] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  const [redigerar, setRedigerar] = useState<string | null>(null)
  const [visaNy, setVisaNy]       = useState(false)
  const [namn, setNamn]   = useState('')
  const [epost, setEpost] = useState('')
  const [tel, setTel]     = useState('')
  const [roll, setRoll]   = useState('')
  const [busy, setBusy]   = useState(false)
  const [error, setError] = useState('')
  const [klart, setKlart] = useState('')

  const supabase = createClient()
  const router   = useRouter()

  useEffect(() => { load() }, [])

  async function load() {
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
    if (!user) { router.push('/login'); return }

    const { data: prof } = await supabase
      .from('profiles').select('*').eq('id', user.id).maybeSingle()
    setProfile(prof)

    const mitt = await hamtaMittForetag(supabase, user.id)
    setCompany(mitt.company)
    setFarAdm(mitt.farAdministrera)

    if (!mitt.company) { setLoading(false); return }

    const { data: h } = await supabase
      .from('handledare')
      .select('id, name, email, phone, roll, user_id, aktiv')
      .eq('company_id', mitt.company.id)
      .order('aktiv', { ascending: false })
      .order('name')

    const rader = (h || []) as Handledare[]
    setLista(rader)
    setMinPost(rader.find(r => r.user_id === user.id)?.id || null)

    const ids = rader.map(r => r.id)

    if (ids.length) {
      // Hur många studenter har var och en tagit emot?
      const { data: pl } = await supabase
        .from('placements')
        .select('handledare_id, status')
        .in('handledare_id', ids)

      const a: Record<string, number> = {}
      for (const p of pl || []) {
        if (['avtal', 'aktiv', 'klar'].includes(p.status)) {
          a[p.handledare_id] = (a[p.handledare_id] || 0) + 1
        }
      }
      setAntal(a)

      // Hur många öppna platser har var och en?
      const { data: lp } = await supabase
        .from('lia_platser')
        .select('handledare_id, status')
        .in('handledare_id', ids)

      const pm: Record<string, number> = {}
      for (const p of lp || []) {
        if (p.status === 'oppen' && p.handledare_id) {
          pm[p.handledare_id] = (pm[p.handledare_id] || 0) + 1
        }
      }
      setPlatser(pm)
    }

    const { data: inv } = await supabase
      .from('member_invites')
      .select('email')
      .eq('company_id', mitt.company.id)
      .is('accepted_at', null)

    setInbjudna((inv || []).map(i => (i.email || '').toLowerCase()))

    setLoading(false)
  }

  function nollstall() {
    setNamn(''); setEpost(''); setTel(''); setRoll('')
    setRedigerar(null); setVisaNy(false); setError('')
  }

  function borjaRedigera(h: Handledare) {
    setRedigerar(h.id)
    setVisaNy(false)
    setNamn(h.name)
    setEpost(h.email || '')
    setTel(h.phone || '')
    setRoll(h.roll || '')
    setError('')
  }

  async function spara(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setError(''); setKlart('')

    const payload = {
      name:  namn.trim(),
      email: epost.trim() || null,
      phone: tel.trim() || null,
      roll:  roll.trim() || null,
    }

    const { error: err } = redigerar
      ? await supabase.from('handledare').update(payload).eq('id', redigerar)
      : await supabase.from('handledare').insert({ ...payload, company_id: company.id })

    setBusy(false)

    if (err) {
      setError(
        err.message.includes('handledare_foretag_epost')
          ? 'Det finns redan en handledare med den e-postadressen här.'
          : err.message
      )
      return
    }

    nollstall()
    load()
  }

  async function vaxlaAktiv(h: Handledare) {
    await supabase.from('handledare').update({ aktiv: !h.aktiv }).eq('id', h.id)
    load()
  }

  async function bjudIn(h: Handledare) {
    if (!h.email) { setError('Lägg till en e-postadress först.'); return }
    setBusy(true); setError(''); setKlart('')

    const res = await fetch('/api/bjud-in-handledare', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId: company.id, email: h.email, name: h.name }),
    })
    const data = await res.json()
    setBusy(false)

    if (!res.ok) { setError(data.error || 'Inbjudan kunde inte skickas'); return }

    setKlart('Inbjudan skickad till ' + h.email)
    load()
  }

  const field = 'w-full bg-paper border border-line rounded-lg px-4 py-2.5 text-sm outline-none focus:border-text/40 transition'

  if (loading) return (
    <div className="min-h-screen bg-paper flex items-center justify-center">
      <p className="text-muted text-sm">Laddar</p>
    </div>
  )

  const formular = (
    <form onSubmit={spara} className="bg-card border border-line rounded-xl p-6 mb-5 space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm mb-1.5">Namn</label>
          <input value={namn} onChange={e => setNamn(e.target.value)} required placeholder="Anna Andersson" className={field} />
        </div>
        <div>
          <label className="block text-sm mb-1.5">E-post</label>
          <input type="email" value={epost} onChange={e => setEpost(e.target.value)} placeholder="anna@foretag.se" className={field} />
        </div>
        <div>
          <label className="block text-sm mb-1.5">Telefon</label>
          <input value={tel} onChange={e => setTel(e.target.value)} className={field} />
        </div>
        <div>
          <label className="block text-sm mb-1.5">Roll eller område</label>
          <input value={roll} onChange={e => setRoll(e.target.value)} placeholder="PLC och automation" className={field} />
        </div>
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className="bg-text text-paper rounded-full px-6 py-2.5 text-sm font-medium hover:opacity-85 transition disabled:opacity-40">
          {busy ? 'Sparar' : redigerar ? 'Spara ändringar' : 'Lägg till'}
        </button>
        <button type="button" onClick={nollstall} className="text-muted text-sm px-3">
          Avbryt
        </button>
      </div>
    </form>
  )

  return (
    <div className="min-h-screen bg-paper text-text flex flex-col lg:flex-row">
      <Sidebar role="company" name={profile?.full_name} subtitle={company?.company_name} />

      <main className="flex-1 p-5 sm:p-8 max-w-3xl">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-2">
          <h1 className="text-2xl sm:text-3xl">Handledare</h1>
          {farAdm && !visaNy && !redigerar && (
            <button
              onClick={() => { setVisaNy(true); setError('') }}
              className="bg-accent text-white px-5 py-2.5 rounded-full text-sm font-medium hover:opacity-85 transition"
            >
              Lägg till handledare
            </button>
          )}
        </div>
        <p className="text-muted text-sm mb-7">
          Personerna hos {company?.company_name || 'er'} som tar emot studenter. Ett
          konto är frivilligt — en handledare räknas och kan stå på avtalet utan att
          logga in.
        </p>

        {error && (
          <p className="bg-alert/10 border border-alert/25 text-alert text-sm rounded-lg px-4 py-3 mb-5">{error}</p>
        )}
        {klart && (
          <p className="bg-ok/10 border border-ok/25 text-ok text-sm rounded-lg px-4 py-3 mb-5">{klart}</p>
        )}

        {!company ? (
          <div className="bg-card border border-line rounded-xl p-6">
            <p className="text-muted text-sm">
              Ditt konto är inte kopplat till något företag ännu.
            </p>
          </div>
        ) : (
          <>
            {(visaNy || redigerar) && formular}

            {lista.length === 0 ? (
              <div className="bg-card border border-line rounded-xl p-10 text-center">
                <p className="mb-1">Inga handledare än</p>
                <p className="text-muted text-sm">
                  {farAdm
                    ? 'Lägg till den som ska ta emot en student. Hon kan få ett konto senare.'
                    : 'Den som registrerade företaget lägger till handledare.'}
                </p>
              </div>
            ) : (
              <div className="bg-card border border-line rounded-xl divide-y divide-line">
                {lista.map(h => {
                  const harKonto  = !!h.user_id
                  const arInbjuden = !harKonto && !!h.email && inbjudna.includes(h.email.toLowerCase())
                  const mottagna  = antal[h.id] || 0
                  const oppna     = platser[h.id] || 0

                  return (
                    <div key={h.id} className={`px-5 py-4 ${h.aktiv ? '' : 'opacity-50'}`}>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium">
                            {h.name}
                            {h.id === minPost && (
                              <span className="text-muted font-normal"> — du</span>
                            )}
                          </p>
                          {h.roll && <p className="text-muted text-sm">{h.roll}</p>}
                          <p className="text-muted text-sm">
                            {[h.email, h.phone].filter(Boolean).join(', ') || 'Inga kontaktuppgifter'}
                          </p>
                          <p className="text-muted text-xs mt-1.5">
                            {mottagna === 0
                              ? 'Inga studenter än'
                              : mottagna + (mottagna === 1 ? ' student mottagen' : ' studenter mottagna')}
                            {oppna > 0 && ' · ' + oppna + (oppna === 1 ? ' öppen plats' : ' öppna platser')}
                          </p>
                        </div>

                        <div className="flex flex-col items-end gap-2 shrink-0">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                            harKonto   ? 'bg-ok/10 text-ok'
                            : arInbjuden ? 'bg-warn/10 text-warn'
                            : 'bg-text/8 text-muted'
                          }`}>
                            {harKonto ? 'Har konto' : arInbjuden ? 'Inbjuden' : 'Utan konto'}
                          </span>

                          {farAdm && (
                            <div className="flex items-center gap-3">
                              <button onClick={() => borjaRedigera(h)} className="text-muted hover:text-text text-sm transition">
                                Ändra
                              </button>
                              {!harKonto && !arInbjuden && h.email && (
                                <button onClick={() => bjudIn(h)} disabled={busy} className="text-accent hover:opacity-75 text-sm transition disabled:opacity-40">
                                  Bjud in till konto
                                </button>
                              )}
                              <button onClick={() => vaxlaAktiv(h)} className="text-muted hover:text-alert text-sm transition">
                                {h.aktiv ? 'Inaktivera' : 'Aktivera'}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            <p className="text-muted text-xs mt-5 leading-relaxed">
              Inaktiverade handledare försvinner ur listan över vem som kan väljas på
              nya platser och avtal, men deras tidigare studenter ligger kvar i
              historiken.
            </p>
          </>
        )}
      </main>
    </div>
  )
}
