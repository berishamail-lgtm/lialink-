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
  const [skolor, setSkolor]     = useState<any[]>([])
  const [skolId, setSkolId]     = useState('')
  const [nySkola, setNySkola]   = useState('')
  const [nyOrgNr, setNyOrgNr]   = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: prof } = await supabase
      .from('profiles').select('*').eq('id', user.id).single()
    setProfile(prof)

    const { data: uppdrag } = await supabase
      .from('education_staff').select('education_id, roll')
      .eq('user_id', user.id).eq('aktiv', true)

    const ids = (uppdrag || []).map(u => u.education_id)
    console.log('Utbildningar: uppdrag', uppdrag?.length, 'ids', ids)
    if (ids.length) {
      const { data } = await supabase
        .from('educations').select('*').in('id', ids).order('program_name')
      setRader(data || [])
    } else {
      setRader([])
    }
        const { data: sk } = await supabase
      .from('schools').select('*').order('name')
    setSkolor(sk || [])

    if (!skolId && rader.length && (rader[0] as any).school_id) {
      setSkolId((rader[0] as any).school_id)
    }
    setLoading(false)
  }

  async function spara(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')

    let valdSkola = skolId

    if (!valdSkola) {
      if (!nySkola.trim()) {
        setError('Välj en skola eller ange en ny.')
        setBusy(false)
        return
      }

      const rensatNr = nyOrgNr.replace(/[^0-9]/g, '')

      let { data: fanns } = await supabase
        .from('schools').select('id').eq('org_number', rensatNr).maybeSingle()

      if (!fanns) {
        const { data: viaNamn } = await supabase
          .from('schools').select('id').ilike('name', nySkola.trim()).maybeSingle()
        fanns = viaNamn
      }

      if (fanns) {
        valdSkola = fanns.id
      } else {
        const { data: ny, error: skErr } = await supabase
          .from('schools')
          .insert({
            name: nySkola.trim(),
            org_number: nyOrgNr.replace(/[^0-9]/g, '') || null,
          })
          .select('id').single()

        if (skErr) { setError(skErr.message); setBusy(false); return }
        valdSkola = ny.id
      }
    }

    const skola = skolor.find(s => s.id === valdSkola)
    const forsta = rader[0]

    const { data: nyEdu, error: err } = await supabase.from('educations').insert({
      user_id:       profile.id,
      school_id:     valdSkola,
      program_name:  program.trim(),
      school_name:   skola?.name || nySkola.trim(),
      city:          city.trim() || null,
      org_number:    orgNr.trim() || skola?.org_number || forsta?.org_number || null,
      phone:         phone.trim() || forsta?.phone || null,
      contact_phone: forsta?.contact_phone || null,
      villkor_text:  forsta?.villkor_text || null,
    }).select('id').single()

    setBusy(false)
    if (err) { setError(err.message); return }
    if (nyEdu) {
      await supabase.from('education_staff').insert({
        education_id: nyEdu.id,
        user_id: profile.id,
        roll: 'ansvarig',
      })
    }
    setProgram(''); setSkola(''); setCity(''); setOrgNr(''); setPhone('')
    setNySkola(''); setNyOrgNr('')
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
                <label className="block text-sm mb-1.5">Utbildningsanordnare</label>
                <select value={skolId} onChange={e => setSkolId(e.target.value)} className={field}>
                  <option value="">Ny utbildningsanordnare</option>
                  {skolor.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name}{s.status !== 'godkänd' ? ' (väntar på godkännande)' : ''}
                    </option>
                  ))}
                </select>
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
            {!skolId && (
              <div className="grid sm:grid-cols-2 gap-4 border-t border-line pt-4">
                <div>
                  <label className="block text-sm mb-1.5">Namn på anordnaren</label>
                  <input value={nySkola} onChange={e => setNySkola(e.target.value)} required={!skolId}
                    placeholder="Yrkeshögskolan i Malmö" className={field} />
                </div>
                <div>
                  <label className="block text-sm mb-1.5">Organisationsnummer</label>
                  <input value={nyOrgNr} onChange={e => setNyOrgNr(e.target.value)}
                    required={!skolId} placeholder="556123-4567" className={field} />
                </div>
                <p className="text-muted text-xs sm:col-span-2">
                  En ny anordnare måste godkännas innan utbildningen kan användas.
                  Godkännandet sker när biträdesavtalet är tecknat.
                </p>
              </div>
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