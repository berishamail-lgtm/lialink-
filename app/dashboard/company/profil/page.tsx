'use client'
import { useEffect, useState } from 'react'
import { createClient } from '../../../lib/supabase'
import { useRouter } from 'next/navigation'

export default function CompanyProfil() {
  const [loading, setLoading]         = useState(true)
  const [saving, setSaving]           = useState(false)
  const [success, setSuccess]         = useState(false)
  const [userId, setUserId]           = useState('')
  const [companyName, setCompanyName] = useState('')
  const [orgNumber, setOrgNumber]     = useState('')
  const [sector, setSector]           = useState('')
  const [description, setDescription] = useState('')
  const [city, setCity]               = useState('')
  const [website, setWebsite]         = useState('')
  const [spotsTotal, setSpotsTotal]   = useState('1')
  const [lookingFor, setLookingFor]   = useState('')
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd]     = useState('')
  const supabase = createClient()
  const router   = useRouter()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)

      const { data: comp } = await supabase
        .from('companies')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (comp) {
        setCompanyName(comp.company_name || '')
        setOrgNumber(comp.org_number || '')
        setSector(comp.sector || '')
        setDescription(comp.description || '')
        setCity(comp.city || '')
        setWebsite(comp.website || '')
        setSpotsTotal(String(comp.spots_total || 1))
        setLookingFor(comp.looking_for || '')
        setPeriodStart(comp.lia_period_start || '')
        setPeriodEnd(comp.lia_period_end || '')
      }

      setLoading(false)
    }
    load()
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)

    const { data: existing } = await supabase
      .from('companies')
      .select('id')
      .eq('user_id', userId)
      .single()

    const payload = {
      user_id:          userId,
      company_name:     companyName,
      org_number:       orgNumber,
      sector,
      description,
      city,
      website,
      spots_total:      parseInt(spotsTotal),
      spots_available:  parseInt(spotsTotal),
      looking_for:      lookingFor,
      lia_period_start: periodStart || null,
      lia_period_end:   periodEnd   || null,
    }

    if (existing) {
      await supabase.from('companies').update(payload).eq('user_id', userId)
    } else {
      await supabase.from('companies').insert(payload)
    }

    setSaving(false)
    setSuccess(true)
    setTimeout(() => router.push('/dashboard/company'), 1500)
  }

  if (loading) return (
    <div className="min-h-screen bg-[#0f0e0d] flex items-center justify-center">
      <p className="text-white">Laddar…</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#0f0e0d] text-white">
      <nav className="border-b border-white/10 px-8 py-4 flex items-center justify-between">
        <div className="font-bold text-xl">
          LIA<span className="text-[#e8420a]">link</span>
        </div>
        <button
          onClick={() => router.push('/dashboard/company')}
          className="text-sm text-white/40 hover:text-white transition"
        >
          ← Tillbaka
        </button>
      </nav>

      <div className="max-w-2xl mx-auto px-8 py-10">
        <div className="mb-8">
          <p className="text-green-400 text-xs font-bold uppercase tracking-widest mb-2">Arbetsgivare</p>
          <h1 className="text-3xl font-bold">Företagsprofil</h1>
          <p className="text-white/40 mt-1 text-sm">
            Fyll i er information så matchar vi er med rätt studenter.
          </p>
        </div>

        <form onSubmit={handleSave} className="space-y-5">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
            <h2 className="font-bold text-sm uppercase tracking-wider text-white/40">Om företaget</h2>

            <div>
              <label className="block text-sm font-semibold mb-1">Företagsnamn *</label>
              <input
                value={companyName}
                onChange={e => setCompanyName(e.target.value)}
                placeholder="Techbolaget AB"
                required
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-white/30 text-white placeholder-white/20"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold mb-1">Organisationsnummer</label>
                <input
                  value={orgNumber}
                  onChange={e => setOrgNumber(e.target.value)}
                  placeholder="556XXX-XXXX"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-white/30 text-white placeholder-white/20"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Stad *</label>
                <input
                  value={city}
                  onChange={e => setCity(e.target.value)}
                  placeholder="Malmö"
                  required
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-white/30 text-white placeholder-white/20"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1">Bransch</label>
              <select
                value={sector}
                onChange={e => setSector(e.target.value)}
                className="w-full bg-[#1a1a1a] border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-white/30 text-white"
              >
                <option value="">Välj bransch…</option>
                <option>IT &amp; Digital</option>
                <option>Marknad &amp; Reklam</option>
                <option>Handel &amp; E-handel</option>
                <option>Teknik &amp; Industri</option>
                <option>Vård &amp; Omsorg</option>
                <option>Konsult &amp; Rådgivning</option>
                <option>Utbildning</option>
                <option>Media &amp; Kommunikation</option>
                <option>Annat</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1">Hemsida</label>
              <input
                value={website}
                onChange={e => setWebsite(e.target.value)}
                placeholder="https://ertforetag.se"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-white/30 text-white placeholder-white/20"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1">Beskriv er verksamhet</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Vad gör ni och vad kan en LIA-student lära sig hos er?"
                rows={4}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-white/30 text-white placeholder-white/20 resize-none"
              />
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
            <h2 className="font-bold text-sm uppercase tracking-wider text-white/40">LIA-info</h2>

            <div>
              <label className="block text-sm font-semibold mb-1">Antal LIA-platser</label>
              <input
                type="number"
                min="1"
                max="20"
                value={spotsTotal}
                onChange={e => setSpotsTotal(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-white/30 text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold mb-1">LIA-start</label>
                <input
                  type="date"
                  value={periodStart}
                  onChange={e => setPeriodStart(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-white/30 text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">LIA-slut</label>
                <input
                  type="date"
                  value={periodEnd}
                  onChange={e => setPeriodEnd(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-white/30 text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1">Vad söker ni hos en student?</label>
              <textarea
                value={lookingFor}
                onChange={e => setLookingFor(e.target.value)}
                placeholder="Beskriv vilken typ av student ni söker och vad ni erbjuder…"
                rows={3}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-white/30 text-white placeholder-white/20 resize-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-white text-[#0f0e0d] rounded-full py-4 font-bold text-sm hover:opacity-80 transition disabled:opacity-50"
          >
            {saving ? 'Sparar…' : success ? '✓ Sparat!' : 'Spara företagsprofil →'}
          </button>
        </form>
      </div>
    </div>
  )
}