'use client'
import { useEffect, useState } from 'react'
import { createClient } from '../../lib/supabase'
import { useRouter } from 'next/navigation'
import Sidebar from '../../components/Sidebar'
import { useEdu } from '../../components/EduContext'

const sectors = [
  'IT och digital', 'Teknik och industri', 'Marknad och reklam',
  'Handel och e-handel', 'Vård och omsorg', 'Konsult och rådgivning',
  'Media och kommunikation', 'Utbildning', 'Annat',
]

export default function NatverkPage() {
  const [profile, setProfile]     = useState<any>(null)
  const [education, setEducation] = useState<any>(null)
  const [partners, setPartners]   = useState<any[]>([])
  const [loading, setLoading]     = useState(true)
  const [show, setShow]           = useState(false)
  const [error, setError]         = useState('')

  const [name, setName]       = useState('')
  const [city, setCity]       = useState('')
  const [sector, setSector]   = useState('')
  const [contact, setContact] = useState('')
  const [email, setEmail]     = useState('')
  const [phone, setPhone]     = useState('')
  const [spots, setSpots]     = useState('1')
  const [note, setNote]       = useState('')

  const supabase = createClient()
  const router   = useRouter()
  const { current } = useEdu()

  useEffect(() => { if (current) load() }, [current?.id])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: prof } = await supabase
      .from('profiles').select('*').eq('id', user.id).single()
    setProfile(prof)

    const edu = current
    setEducation(edu)

    if (edu) {
      const { data } = await supabase
        .from('education_partners')
        .select('*, companies(*)')
        .eq('education_id', edu.id)
        .order('created_at', { ascending: false })
      setPartners(data || [])
    }
    setLoading(false)
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const { data: co, error: coErr } = await supabase
      .from('companies')
      .insert({
        company_name:    name.trim(),
        city:            city.trim(),
        sector:          sector || null,
        contact_name:    contact.trim() || null,
        contact_email:   email.trim() || null,
        contact_phone:   phone.trim() || null,
        spots_total:     parseInt(spots) || 1,
        spots_available: parseInt(spots) || 1,
        origin:          'ul',
        claimed:         false,
      })
      .select('id').single()

    if (coErr) { setError(coErr.message); return }

    const { error: pErr } = await supabase.from('education_partners').insert({
      education_id: education.id,
      company_id:   co.id,
      note:         note.trim() || null,
    })

    if (pErr) { setError(pErr.message); return }

    setName(''); setCity(''); setSector(''); setContact('')
    setEmail(''); setPhone(''); setSpots('1'); setNote('')
    setShow(false)
    load()
  }

  async function remove(id: string) {
    if (!confirm('Ta bort företaget från ditt nätverk?')) return
    await supabase.from('education_partners').delete().eq('id', id)
    load()
  }

  async function invite(companyId: string) {
    setError('')
    const res = await fetch('/api/bjud-in', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId, educationId: education.id }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error || 'Inbjudan kunde inte skickas'); return }
    alert('Inbjudan skickad till ' + data.email)
  }

  const field = 'w-full bg-paper border border-line rounded-lg px-4 py-2.5 text-sm outline-none focus:border-text/40 transition'

  if (loading) return (
    <div className="min-h-screen bg-paper flex items-center justify-center">
      <p className="text-muted text-sm">Laddar</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-paper text-text flex flex-col lg:flex-row">
      <Sidebar role="education" name={profile?.full_name} subtitle={education?.program_name} />

      <main className="flex-1 p-5 sm:p-8 max-w-3xl">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-2">
          <h1 className="text-2xl sm:text-3xl">Företagsnätverk</h1>
          <button
            onClick={() => { setShow(!show); setError('') }}
            className="bg-accent text-white px-5 py-2.5 rounded-full text-sm font-medium hover:opacity-85 transition"
          >
            {show ? 'Avbryt' : 'Lägg till företag'}
          </button>
        </div>
        <p className="text-muted text-sm mb-7">
          Företag du har relation med. De behöver inget konto för att ligga här, men
          kan bara signera avtal digitalt om de skapar ett.
        </p>

        {error && (
          <p className="bg-alert/10 border border-alert/25 text-alert text-sm rounded-lg px-4 py-3 mb-5">
            {error}
          </p>
        )}

        {show && (
          <form onSubmit={save} className="bg-card border border-line rounded-xl p-6 mb-5 space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm mb-1.5">Företagsnamn</label>
                <input value={name} onChange={e => setName(e.target.value)} required placeholder="Automations AB" className={field} />
              </div>
              <div>
                <label className="block text-sm mb-1.5">Ort</label>
                <input value={city} onChange={e => setCity(e.target.value)} required placeholder="Malmö" className={field} />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm mb-1.5">Bransch</label>
                <select value={sector} onChange={e => setSector(e.target.value)} className={field}>
                  <option value="">Välj bransch</option>
                  {sectors.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm mb-1.5">Antal platser</label>
                <input type="number" min="1" value={spots} onChange={e => setSpots(e.target.value)} className={field} />
              </div>
            </div>

            <div className="grid sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm mb-1.5">Kontaktperson</label>
                <input value={contact} onChange={e => setContact(e.target.value)} placeholder="Namn" className={field} />
              </div>
              <div>
                <label className="block text-sm mb-1.5">E-post</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="namn@foretag.se" className={field} />
              </div>
              <div>
                <label className="block text-sm mb-1.5">Telefon</label>
                <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="070-123 45 67" className={field} />
              </div>
            </div>

            <div>
              <label className="block text-sm mb-1.5">Anteckning</label>
              <textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                rows={2}
                placeholder="Tar gärna emot inom automation, brukar höra av sig i god tid"
                className={`${field} resize-y`}
              />
            </div>

            <button type="submit" className="bg-text text-paper rounded-full px-6 py-2.5 text-sm font-medium hover:opacity-85 transition">
              Lägg till i nätverket
            </button>
          </form>
        )}

        {partners.length === 0 ? (
          <div className="bg-card border border-line rounded-xl p-12 text-center">
            <p className="mb-1">Nätverket är tomt</p>
            <p className="text-muted text-sm">
              Lägg in företagen du redan samarbetar med, så har du dem samlade
              när nästa LIA-period ska planeras.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {partners.map(p => {
              const c = p.companies
              return (
                <article key={p.id} className="bg-card border border-line rounded-xl p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-base">{c?.company_name}</h2>
                        {!c?.claimed && (
                          <span className="bg-warn/10 text-warn rounded-full px-2.5 py-0.5 text-xs">
                            inget konto
                          </span>
                        )}
                      </div>
                      <p className="text-muted text-sm mt-0.5">
                        {c?.sector ? c.sector + ', ' : ''}{c?.city}
                      </p>
                      {(c?.contact_name || c?.contact_email) && (
                        <p className="text-muted text-sm mt-1">
                          {c.contact_name}
                          {c.contact_email ? ', ' + c.contact_email : ''}
                          {c.contact_phone ? ', ' + c.contact_phone : ''}
                        </p>
                      )}
                      {p.note && (
                        <p className="text-sm mt-2 leading-relaxed">{p.note}</p>
                      )}
                    </div>
                    <div className="flex flex-col gap-2 shrink-0 items-end">
                      {!c?.claimed && c?.contact_email && (
                        <button onClick={() => invite(c.id)} className="bg-text text-paper rounded-full px-4 py-1.5 text-sm font-medium hover:opacity-85 transition">Bjud in</button>
                      )}
                      <button onClick={() => remove(p.id)} className="text-muted hover:text-alert text-sm transition">Ta bort</button>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}