'use client'
import { useEffect, useState } from 'react'
import { createClient } from '../../lib/supabase'
import { useRouter } from 'next/navigation'
import Sidebar from '../../components/Sidebar'
import { useEdu } from '../../components/EduContext'

export default function UtbildningarPage() {
  const [profile, setProfile] = useState<any>(null)
  const [rader, setRader]     = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [show, setShow]       = useState(false)
  const [error, setError]     = useState('')
  const [busy, setBusy]       = useState(false)

  const [program, setProgram] = useState('')
  const [skola, setSkola]     = useState('')
  const [city, setCity]       = useState('')
  const [orgNr, setOrgNr]     = useState('')
  const [phone, setPhone]     = useState('')

  const supabase = createClient()
  const router   = useRouter()

  useEffect(() => { load() }, [])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: prof } = await supabase
      .from('profiles').select('*').eq('id', user.id).single()
    setProfile(prof)

    const { data } = await supabase
      .from('educations').select('*').eq('user_id', user.id).order('program_name')
    setRader(data || [])
    setLoading(false)
  }

  async function spara(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')

    const forsta = rader[0]

    const { error: err } = await supabase.from('educations').insert({
      user_id:      profile.id,
      program_name: program.trim(),
      school_name:  skola.trim(),
      city:         city.trim() || null,
      org_number:   orgNr.trim() || forsta?.org_number || null,
      phone:        phone.trim() || forsta?.phone || null,
      contact_phone: forsta?.contact_phone || null,
      villkor_text: forsta?.villkor_text || null,
      status:       forsta?.status === 'godkänd' ? 'godkänd' : 'väntar',
      avtal_tecknat: forsta?.avtal_tecknat || null,
    })

    setBusy(false)
    if (err) { setError(err.message); return }

    setProgram(''); setSkola(''); setCity(''); setOrgNr(''); setPhone('')
    setShow(false)
    window.location.reload()
  }

  async function arkivera(id: string) {
    if (!confirm('Arkivera utbildningen? Den döljs men data finns kvar.')) return
    await supabase.from('educations').update({ active: false }).eq('id', id)
    window.location.reload()
  }

  const field = 'w-full bg-paper border border-line rounded-lg px-4 py-2.5 text-sm outline-none focus:border-text/40 transition'

  if (loading) return (
    <div className="min-h-screen bg-paper flex items-center justify-center">
      <p className="text-muted text-sm">Laddar</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-paper text-text flex flex-col lg:flex-row">
      <Sidebar role="education" name={profile?.full_name} />

      <main className="flex-1 p-5 sm:p-8 max-w-3xl">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-2">
          <h1 className="text-2xl sm:text-3xl">Mina utbildningar</h1>
          <button
            onClick={() => { setShow(!show); setError('') }}
            className="bg-accent text-white px-5 py-2.5 rounded-full text-sm font-medium hover:opacity-85 transition"
          >
            {show ? 'Avbryt' : 'Lägg till utbildning'}
          </button>
        </div>
        <p className="text-muted text-sm mb-7">
          Ansvarar du för flera program lägger du upp dem här. Du växlar mellan dem
          i menyn till vänster.
        </p>

        {error && (
          <p className="bg-alert/10 border border-alert/25 text-alert text-sm rounded-lg px-4 py-3 mb-5">
            {error}
          </p>
        )}

        {show && (
          <form onSubmit={spara} className="bg-card border border-line rounded-xl p-6 mb-5 space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm mb-1.5">Programnamn</label>
                <input value={program} onChange={e => setProgram(e.target.value)} required placeholder="Systemingenjör 4.0" className={field} />
              </div>
              <div>
                <label className="block text-sm mb-1.5">Skola</label>
                <input value={skola} onChange={e => setSkola(e.target.value)} required placeholder="Lernia Yrkeshögskola" className={field} />
              </div>
            </div>

            <div className="grid sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm mb-1.5">Ort</label>
                <input value={city} onChange={e => setCity(e.target.value)} placeholder="Malmö" className={field} />
              </div>
              <div>
                <label className="block text-sm mb-1.5">Organisationsnummer</label>
                <input value={orgNr} onChange={e => setOrgNr(e.target.value)} placeholder="Ärvs om tomt" className={field} />
              </div>
              <div>
                <label className="block text-sm mb-1.5">Telefon</label>
                <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Ärvs om tomt" className={field} />
              </div>
            </div>

            <p className="text-muted text-xs">
              Organisationsnummer, telefon och avtalsvillkor hämtas från din första
              utbildning om du lämnar fälten tomma.
            </p>

            <button type="submit" disabled={busy} className="bg-text text-paper rounded-full px-6 py-2.5 text-sm font-medium hover:opacity-85 transition disabled:opacity-40">
              {busy ? 'Sparar' : 'Lägg till'}
            </button>
          </form>
        )}

        <div className="space-y-3">
          {rader.map(e => (
            <article key={e.id} className="bg-card border border-line rounded-xl p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-base">{e.program_name}</h2>
                  <p className="text-muted text-sm mt-0.5">
                    {e.school_name}{e.city ? ', ' + e.city : ''}
                  </p>
                  {!e.active && (
                    <p className="text-muted text-sm mt-1">Arkiverad</p>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                    e.status === 'godkänd' ? 'bg-ok/10 text-ok' : 'bg-warn/10 text-warn'
                  }`}>
                    {e.status === 'godkänd' ? 'Godkänd' : 'Väntar'}
                  </span>
                  {e.active && rader.filter(x => x.active).length > 1 && (
                    <button onClick={() => arkivera(e.id)} className="text-muted hover:text-alert text-sm transition">
                      Arkivera
                    </button>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      </main>
    </div>
  )
}