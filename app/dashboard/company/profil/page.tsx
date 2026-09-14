'use client'
import { useEffect, useState } from 'react'
import { createClient } from '../../../lib/supabase'
import { useRouter } from 'next/navigation'
import Sidebar from '../../../components/Sidebar'

const sectors = [
  'IT och digital', 'Teknik och industri', 'Marknad och reklam',
  'Handel och e-handel', 'Vård och omsorg', 'Konsult och rådgivning',
  'Media och kommunikation', 'Utbildning', 'Annat',
]

export default function CompanyProfil() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)
  const [userId, setUserId]   = useState('')
  const [profile, setProfile] = useState<any>(null)

  const [name, setName]       = useState('')
  const [orgNr, setOrgNr]     = useState('')
  const [sector, setSector]   = useState('')
  const [city, setCity]       = useState('')
  const [website, setWebsite] = useState('')
  const [desc, setDesc]       = useState('')
  const [spots, setSpots]     = useState('1')
  const [looking, setLooking] = useState('')
  const [start, setStart]     = useState('')
  const [end, setEnd]         = useState('')

  const supabase = createClient()
  const router   = useRouter()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)

      const { data: prof } = await supabase
        .from('profiles').select('*').eq('id', user.id).single()
      setProfile(prof)

      const { data: c } = await supabase
        .from('companies').select('*').eq('user_id', user.id).single()

      if (c) {
        setName(c.company_name || '')
        setOrgNr(c.org_number || '')
        setSector(c.sector || '')
        setCity(c.city || '')
        setWebsite(c.website || '')
        setDesc(c.description || '')
        setSpots(String(c.spots_total || 1))
        setLooking(c.looking_for || '')
        setStart(c.lia_period_start || '')
        setEnd(c.lia_period_end || '')
      }
      setLoading(false)
    }
    load()
  }, [])

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)

    const payload = {
      user_id:          userId,
      company_name:     name,
      org_number:       orgNr,
      sector, city, website,
      description:      desc,
      spots_total:      parseInt(spots) || 1,
      spots_available:  parseInt(spots) || 1,
      looking_for:      looking,
      lia_period_start: start || null,
      lia_period_end:   end   || null,
    }

    const { data: existing } = await supabase
      .from('companies').select('id').eq('user_id', userId).single()

    if (existing) {
      await supabase.from('companies').update(payload).eq('user_id', userId)
    } else {
      await supabase.from('companies').insert(payload)
    }

    setSaving(false)
    setSaved(true)
    setTimeout(() => router.push('/dashboard/company'), 900)
  }

  const field = 'w-full bg-card border border-line rounded-lg px-4 py-2.5 text-sm outline-none focus:border-text/40 transition'

  if (loading) return (
    <div className="min-h-screen bg-paper flex items-center justify-center">
      <p className="text-muted text-sm">Laddar</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-paper text-text flex flex-col lg:flex-row">
      <Sidebar role="company" name={profile?.full_name} subtitle={name} />

      <main className="flex-1 p-5 sm:p-8 max-w-2xl">
        <h1 className="text-2xl sm:text-3xl mb-1">Företagsprofil</h1>
        <p className="text-muted text-sm mb-7">
          Ort och LIA-period styr vilka studenter ni matchas med. Beskrivningen läser de innan de hör av sig.
        </p>

        <form onSubmit={save} className="space-y-5">
          <section className="bg-card border border-line rounded-xl p-6 space-y-4">
            <h2 className="text-base">Företaget</h2>

            <div>
              <label className="block text-sm mb-1.5">Namn</label>
              <input value={name} onChange={e => setName(e.target.value)} required placeholder="Automations AB" className={field} />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm mb-1.5">Organisationsnummer</label>
                <input value={orgNr} onChange={e => setOrgNr(e.target.value)} placeholder="556123-4567" className={field} />
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
                <label className="block text-sm mb-1.5">Webbplats</label>
                <input value={website} onChange={e => setWebsite(e.target.value)} placeholder="https://" className={field} />
              </div>
            </div>

            <div>
              <label className="block text-sm mb-1.5">Beskrivning</label>
              <textarea
                value={desc}
                onChange={e => setDesc(e.target.value)}
                rows={4}
                placeholder="Vad gör ni, och vad får en student vara med om hos er?"
                className={`${field} resize-y`}
              />
            </div>
          </section>

          <section className="bg-card border border-line rounded-xl p-6 space-y-4">
            <h2 className="text-base">LIA hos er</h2>

            <div>
              <label className="block text-sm mb-1.5">Antal platser</label>
              <input type="number" min="1" max="20" value={spots} onChange={e => setSpots(e.target.value)} className={`${field} max-w-32`} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm mb-1.5">Kan ta emot från</label>
                <input type="date" value={start} onChange={e => setStart(e.target.value)} className={field} />
              </div>
              <div>
                <label className="block text-sm mb-1.5">Till och med</label>
                <input type="date" value={end} onChange={e => setEnd(e.target.value)} className={field} />
              </div>
            </div>

            <div>
              <label className="block text-sm mb-1.5">Vad ni söker</label>
              <textarea
                value={looking}
                onChange={e => setLooking(e.target.value)}
                rows={3}
                placeholder="PLC, felsökning, intresse för automation"
                className={`${field} resize-y`}
              />
              <p className="text-muted text-xs mt-1.5">
                Skriv gärna konkreta kompetenser. Matchningen jämför dem mot studenternas.
              </p>
            </div>
          </section>

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-text text-paper rounded-full py-3.5 text-sm font-medium hover:opacity-85 transition disabled:opacity-40"
          >
            {saving ? 'Sparar' : saved ? 'Sparat' : 'Spara företagsprofil'}
          </button>
        </form>
      </main>
    </div>
  )
}