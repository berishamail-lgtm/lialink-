'use client'
import { useEffect, useState } from 'react'
import { createClient } from '../../../lib/supabase'
import { useRouter } from 'next/navigation'
import Sidebar from '../../../components/Sidebar'
import { useEdu } from '../../../components/EduContext'

export default function SkapaAvtal() {
  const [profile, setProfile]       = useState<any>(null)
  const [education, setEducation]   = useState<any>(null)
  const [placements, setPlacements] = useState<any[]>([])
  const [companies, setCompanies]   = useState<any[]>([])

  const [placementId, setPlacementId] = useState('')
  const [companyId, setCompanyId]     = useState('')
  const [start, setStart]             = useState('')
  const [end, setEnd]                 = useState('')

  const [handledare, setHandledare]   = useState('')
  const [hPhone, setHPhone]           = useState('')
  const [hEmail, setHEmail]           = useState('')
  const [coPhone, setCoPhone]         = useState('')

  const [sAddress, setSAddress]       = useState('')
  const [sPhone, setSPhone]           = useState('')
  const [villkor, setVillkor]         = useState('')

  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(true)

  const supabase = createClient()
  const router   = useRouter()
  const { current } = useEdu()

  useEffect(() => {
    if (!current) return
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: prof } = await supabase
        .from('profiles').select('*').eq('id', user.id).single()
      setProfile(prof)

      const edu = current
      setEducation(edu)

      if (edu) {
        const { data: cls } = await supabase
          .from('classes').select('id').eq('education_id', edu.id)
        const classIds = (cls || []).map(c => c.id)

        if (classIds.length) {
          const { data: per } = await supabase
            .from('lia_periods').select('id').in('class_id', classIds)
          const periodIds = (per || []).map(p => p.id)

          if (periodIds.length) {
            const { data: pl } = await supabase
              .from('placements')
              .select(`
                id, status, actual_start, actual_end, company_id,
                lia_periods(name, start_date, end_date, classes(name)),
                students(id, user_id, profiles(full_name, city))
              `)
              .in('lia_period_id', periodIds)
              .not('status', 'in', '("klar","avbruten")')
            setPlacements(pl || [])
          }
        }
      }

      const { data: comps } = await supabase
        .from('companies')
        .select('id, company_name, city, phone, contact_name, contact_email, contact_phone')
        .order('company_name')
      setCompanies(comps || [])

      setLoading(false)
    }
    load()
  }, [current?.id])

  useEffect(() => {
    const pl = placements.find(p => p.id === placementId)
    if (!pl) return
    setStart(pl.actual_start || pl.lia_periods?.start_date || '')
    setEnd(pl.actual_end   || pl.lia_periods?.end_date   || '')
    if (pl.company_id) setCompanyId(pl.company_id)
  }, [placementId])

  useEffect(() => {
    const co = companies.find(c => c.id === companyId)
    if (!co) return
    setCoPhone(co.phone || '')
    if (co.contact_name && !handledare) {
      setHandledare(co.contact_name)
      setHEmail(co.contact_email || '')
      setHPhone(co.contact_phone || '')
    }
  }, [companyId])

  async function create(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')

    const pl = placements.find(p => p.id === placementId)

    const { error: err } = await supabase.from('agreements').insert({
      placement_id:      placementId,
      student_id:        pl?.students?.id,
      company_id:        companyId,
      education_id:      education.id,
      lia_start:         start,
      lia_end:           end,
      handledare_name:   handledare.trim() || null,
      handledare_email:  hEmail.trim() || null,
      handledare_phone:  hPhone.trim() || null,
      student_address:   sAddress.trim() || null,
      student_phone:     sPhone.trim() || null,
      sarskilda_villkor: villkor.trim() || null,
      status:            'skickat',
    })

    if (err) { setError(err.message); setSaving(false); return }

    if (coPhone.trim()) {
      await supabase.from('companies').update({ phone: coPhone.trim() }).eq('id', companyId)
    }

    await supabase.from('placements')
      .update({ company_id: companyId, status: 'avtal' })
      .eq('id', placementId)

    router.push('/dashboard/agreements')
  }

  const field = 'w-full bg-card border border-line rounded-lg px-4 py-2.5 text-sm outline-none focus:border-text/40 transition'
  const vald  = placements.find(p => p.id === placementId)
  
  if (loading) return (
    <div className="min-h-screen bg-paper flex items-center justify-center">
      <p className="text-muted text-sm">Laddar</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-paper text-text flex flex-col lg:flex-row">
      <Sidebar role="education" name={profile?.full_name} subtitle={education?.program_name} />

      <main className="flex-1 p-5 sm:p-8 max-w-2xl">
        <h1 className="text-2xl sm:text-3xl mb-1">Nytt LIA-avtal</h1>
        <p className="text-muted text-sm mb-7">
          Personnummer lämnas tomt i avtalet och fylls i för hand vid signering.
        </p>

        {error && (
          <p className="bg-alert/10 border border-alert/25 text-alert text-sm rounded-lg px-4 py-3 mb-5">
            {error}
          </p>
        )}

        {placements.length === 0 ? (
          <div className="bg-card border border-line rounded-xl p-10 text-center">
            <p className="mb-1">Inga placeringar att skriva avtal för</p>
            <p className="text-muted text-sm">
              Lägg upp LIA-perioder under Planering och låt studenterna ansluta med YH-koden.
            </p>
          </div>
        ) : (
          <form onSubmit={create} className="space-y-5">

            <section className="bg-card border border-line rounded-xl p-6 space-y-4">
              <h2 className="text-base">Student och period</h2>

              <div>
                <label className="block text-sm mb-1.5">Placering</label>
                <select value={placementId} onChange={e => setPlacementId(e.target.value)} required className={field}>
                  <option value="">Välj student och LIA-period</option>
                  {placements.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.students?.profiles?.full_name} — {p.lia_periods?.name}, {p.lia_periods?.classes?.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm mb-1.5">Startdatum</label>
                  <input type="date" value={start} onChange={e => setStart(e.target.value)} required className={field} />
                </div>
                <div>
                  <label className="block text-sm mb-1.5">Slutdatum</label>
                  <input type="date" value={end} onChange={e => setEnd(e.target.value)} required className={field} />
                </div>
              </div>

              {vald && (
                <p className="text-muted text-sm">
                  Planerad period för {vald.lia_periods?.name} är {vald.lia_periods?.start_date} till {vald.lia_periods?.end_date}.
                </p>
              )}

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm mb-1.5">Studentens adress</label>
                  <input value={sAddress} onChange={e => setSAddress(e.target.value)} placeholder="Gatan 1, 211 00 Malmö" className={field} />
                </div>
                <div>
                  <label className="block text-sm mb-1.5">Studentens telefon</label>
                  <input value={sPhone} onChange={e => setSPhone(e.target.value)} placeholder="070-123 45 67" className={field} />
                </div>
              </div>
            </section>

            <section className="bg-card border border-line rounded-xl p-6 space-y-4">
              <h2 className="text-base">Mottagaren</h2>

              <div>
                <label className="block text-sm mb-1.5">Företag</label>
                <select value={companyId} onChange={e => setCompanyId(e.target.value)} required className={field}>
                  <option value="">Välj företag</option>
                  {companies.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.company_name}{c.city ? ', ' + c.city : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm mb-1.5">Företagets telefon</label>
                <input value={coPhone} onChange={e => setCoPhone(e.target.value)} placeholder="040-12 34 56" className={field} />
              </div>

              <div className="border-t border-line pt-4">
                <p className="text-sm mb-3">Handledare på plats</p>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm mb-1.5">Namn</label>
                    <input value={handledare} onChange={e => setHandledare(e.target.value)} required placeholder="Anna Andersson" className={field} />
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm mb-1.5">Telefon</label>
                      <input value={hPhone} onChange={e => setHPhone(e.target.value)} placeholder="070-123 45 67" className={field} />
                    </div>
                    <div>
                      <label className="block text-sm mb-1.5">E-post</label>
                      <input type="email" value={hEmail} onChange={e => setHEmail(e.target.value)} placeholder="anna@foretag.se" className={field} />
                    </div>
                  </div>
                </div>

                <p className="text-muted text-xs mt-3">
                  Handledaren får utvärderingsformuläret när LIA-perioden är slut.
                </p>
              </div>
            </section>

            <section className="bg-card border border-line rounded-xl p-6">
              <h2 className="text-base mb-4">Särskilda villkor</h2>
              <textarea
                value={villkor}
                onChange={e => setVillkor(e.target.value)}
                rows={3}
                placeholder="Skiftarbete, resor i tjänsten, eget sekretessavtal eller annat som avviker"
                className={field + ' resize-y'}
              />
              <p className="text-muted text-xs mt-2">
                Lämna tomt om inget särskilt gäller.
              </p>
            </section>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 bg-text text-paper rounded-full py-3.5 text-sm font-medium hover:opacity-85 transition disabled:opacity-40"
              >
                {saving ? 'Skapar' : 'Skapa avtal'}
              </button>
              <button
                type="button"
                onClick={() => router.push('/dashboard/agreements')}
                className="text-muted text-sm px-5"
              >
                Avbryt
              </button>
            </div>
          </form>
        )}
      </main>
    </div>
  )
}