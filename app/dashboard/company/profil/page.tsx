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
  const [companyId, setCompanyId] = useState('')
  const [profile, setProfile] = useState<any>(null)

  const [name, setName]       = useState('')
  const [orgNr, setOrgNr]     = useState('')
  const [sector, setSector]   = useState('')
  const [city, setCity]       = useState('')
  const [phone, setPhone]     = useState('')
  const [website, setWebsite] = useState('')
  const [desc, setDesc]       = useState('')
  const [spots, setSpots]     = useState('1')
  const [looking, setLooking] = useState('')
  const [start, setStart]     = useState('')
  const [end, setEnd]         = useState('')

  const [openTo, setOpenTo]         = useState('alla')
  const [educations, setEducations] = useState<any[]>([])
  const [valda, setValda]           = useState<string[]>([])

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
        .from('companies').select('*').eq('user_id', user.id).maybeSingle()

      if (c) {
        setCompanyId(c.id)
        setName(c.company_name || '')
        setOrgNr(c.org_number || '')
        setSector(c.sector || '')
        setCity(c.city || '')
        setPhone(c.phone || '')
        setWebsite(c.website || '')
        setDesc(c.description || '')
        setSpots(String(c.spots_total || 1))
        setLooking(c.looking_for || '')
        setStart(c.lia_period_start || '')
        setEnd(c.lia_period_end || '')
        setOpenTo(c.open_to || 'alla')

        const { data: rader } = await supabase
          .from('company_educations').select('education_id').eq('company_id', c.id)
        setValda((rader || []).map(r => r.education_id))
      }

      const { data: alla } = await supabase
        .from('educations').select('id, school_name, program_name').order('school_name')
      setEducations(alla || [])

      setLoading(false)
    }
    load()
  }, [])

  function vaxla(id: string) {
    setValda(valda.includes(id) ? valda.filter(v => v !== id) : [...valda, id])
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)

    const payload = {
      user_id:          userId,
      company_name:     name,
      org_number:       orgNr,
      sector, city, website,
      phone,
      description:      desc,
      spots_total:      parseInt(spots) || 1,
      spots_available:  parseInt(spots) || 1,
      looking_for:      looking,
      lia_period_start: start || null,
      lia_period_end:   end   || null,
      open_to:          openTo,
    }

    let id = companyId

    if (companyId) {
      await supabase.from('companies').update(payload).eq('id', companyId)
    } else {
      const { data: ny } = await supabase
        .from('companies').insert(payload).select('id').single()
      id = ny?.id || ''
      setCompanyId(id)
    }

    if (id) {
      await supabase.from('company_educations').delete().eq('company_id', id)
      if (openTo === 'valda' && valda.length) {
        await supabase.from('company_educations').insert(
          valda.map(eduId => ({ company_id: id, education_id: eduId }))
        )
      }
    }

    setSaving(false)
    setSaved(true)
    setTimeout(() => router.push('/dashboard/company'), 900)
  }

  const field = 'w-full bg-paper border border-line rounded-lg px-4 py-2.5 text-sm outline-none focus:border-text/40 transition'

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
          Ort och LIA-period styr vilka studenter ni matchas med.
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
                <label className="block text-sm mb-1.5">Telefon</label>
                <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="040-12 34 56" className={field} />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm mb-1.5">Ort</label>
                <input value={city} onChange={e => setCity(e.target.value)} required placeholder="Malmö" className={field} />
              </div>
              <div>
                <label className="block text-sm mb-1.5">Bransch</label>
                <select value={sector} onChange={e => setSector(e.target.value)} className={field}>
                  <option value="">Välj bransch</option>
                  {sectors.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm mb-1.5">Webbplats</label>
              <input value={website} onChange={e => setWebsite(e.target.value)} placeholder="https://" className={field} />
            </div>

            <div>
              <label className="block text-sm mb-1.5">Beskrivning</label>
              <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={4} placeholder="Vad gör ni, och vad får en student vara med om hos er?" className={field + ' resize-y'} />
            </div>
          </section>

          <section className="bg-card border border-line rounded-xl p-6 space-y-4">
            <h2 className="text-base">LIA hos er</h2>

            <div>
              <label className="block text-sm mb-1.5">Antal platser</label>
              <input type="number" min="1" max="20" value={spots} onChange={e => setSpots(e.target.value)} className={field + ' max-w-32'} />
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
              <textarea value={looking} onChange={e => setLooking(e.target.value)} rows={3} placeholder="PLC, felsökning, intresse för automation" className={field + ' resize-y'} />
              <p className="text-muted text-xs mt-1.5">
                Skriv gärna konkreta kompetenser. Matchningen jämför dem mot studenternas.
              </p>
            </div>
          </section>

          <section className="bg-card border border-line rounded-xl p-6 space-y-4">
            <h2 className="text-base">Vilka utbildningar tar ni emot från?</h2>

            <label className="flex items-start gap-3 cursor-pointer">
              <input type="radio" checked={openTo === 'alla'} onChange={() => setOpenTo('alla')} className="mt-1 accent-[#e8420a]" />
              <span>
                <span className="text-sm">Alla utbildningar</span>
                <span className="block text-muted text-sm">Ni syns för alla YH-utbildningar på plattformen.</span>
              </span>
            </label>

            <label className="flex items-start gap-3 cursor-pointer">
              <input type="radio" checked={openTo === 'valda'} onChange={() => setOpenTo('valda')} className="mt-1 accent-[#e8420a]" />
              <span>
                <span className="text-sm">Bara utvalda</span>
                <span className="block text-muted text-sm">Ni matchas enbart med de utbildningar ni kryssar i.</span>
              </span>
            </label>

            {openTo === 'valda' && (
              <div className="border-t border-line pt-4 space-y-2">
                {educations.length === 0 ? (
                  <p className="text-muted text-sm">Inga utbildningar finns upplagda än.</p>
                ) : educations.map(e => (
                  <label key={e.id} className="flex items-start gap-3 cursor-pointer">
                    <input type="checkbox" checked={valda.includes(e.id)} onChange={() => vaxla(e.id)} className="mt-1 accent-[#e8420a]" />
                    <span>
                      <span className="text-sm">{e.program_name}</span>
                      <span className="block text-muted text-sm">{e.school_name}</span>
                    </span>
                  </label>
                ))}
                {valda.length === 0 && (
                  <p className="text-alert text-sm pt-2">
                    Ingen utbildning vald. Ni kommer inte matchas med några studenter.
                  </p>
                )}
              </div>
            )}
          </section>

          <button type="submit" disabled={saving} className="w-full bg-text text-paper rounded-full py-3.5 text-sm font-medium hover:opacity-85 transition disabled:opacity-40">
            {saving ? 'Sparar' : saved ? 'Sparat' : 'Spara företagsprofil'}
          </button>
        </form>
      </main>
    </div>
  )
}