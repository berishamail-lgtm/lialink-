'use client'
import { useEffect, useState } from 'react'
import { createClient } from '../../../lib/supabase'
import { useRouter } from 'next/navigation'
import Sidebar from '../../../components/Sidebar'

export default function SkapaAvtal() {
  const [profile, setProfile]     = useState<any>(null)
  const [education, setEducation] = useState<any>(null)
  const [placements, setPlacements] = useState<any[]>([])
  const [companies, setCompanies] = useState<any[]>([])

  const [placementId, setPlacementId] = useState('')
  const [companyId, setCompanyId]     = useState('')
  const [start, setStart]             = useState('')
  const [end, setEnd]                 = useState('')

  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')
  const [loading, setLoading] = useState(true)

  const supabase = createClient()
  const router   = useRouter()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: prof } = await supabase
        .from('profiles').select('*').eq('id', user.id).single()
      setProfile(prof)

      const { data: edu } = await supabase
        .from('educations').select('*').eq('user_id', user.id).single()
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
                id, status, actual_start, actual_end,
                lia_periods(name, start_date, end_date, classes(name)),
                students(profiles(full_name))
              `)
              .in('lia_period_id', periodIds)
              .not('status', 'in', '("klar","avbruten")')
            setPlacements(pl || [])
          }
        }
      }

      const { data: comps } = await supabase
        .from('companies').select('id, company_name, city').order('company_name')
      setCompanies(comps || [])

      setLoading(false)
    }
    load()
  }, [])

  // Fyll datum automatiskt när placering väljs
  useEffect(() => {
    const pl = placements.find(p => p.id === placementId)
    if (!pl) return
    setStart(pl.actual_start || pl.lia_periods?.start_date || '')
    setEnd(pl.actual_end   || pl.lia_periods?.end_date   || '')
  }, [placementId])

  async function create(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')

    const pl = placements.find(p => p.id === placementId)

    const { error: err } = await supabase.from('agreements').insert({
      placement_id: placementId,
      student_id:   pl?.students?.id,
      company_id:   companyId,
      education_id: education.id,
      lia_start:    start,
      lia_end:      end,
      status:       'skickat',
    })

    if (err) { setError(err.message); setSaving(false); return }

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
          Avtalet kopplas till en specifik LIA-period, så att rätt kurs redovisas.
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
              Lägg upp LIA-perioder under Planering, och låt studenterna ansluta med YH-koden.
            </p>
          </div>
        ) : (
          <form onSubmit={create} className="space-y-5">
            <section className="bg-card border border-line rounded-xl p-6 space-y-4">
              <div>
                <label className="block text-sm mb-1.5">Student och LIA-period</label>
                <select value={placementId} onChange={e => setPlacementId(e.target.value)} required className={field}>
                  <option value="">Välj placering</option>
                  {placements.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.students?.profiles?.full_name} — {p.lia_periods?.name}, {p.lia_periods?.classes?.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm mb-1.5">Företag</label>
                <select value={companyId} onChange={e => setCompanyId(e.target.value)} required className={field}>
                  <option value="">Välj företag</option>
                  {companies.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.company_name}{c.city ? `, ${c.city}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </section>

            <section className="bg-card border border-line rounded-xl p-6 space-y-4">
              <h2 className="text-base">Period</h2>

              {vald && (
                <p className="text-muted text-sm">
                  Planerad period för {vald.lia_periods?.name} är{' '}
                  {vald.lia_periods?.start_date} till {vald.lia_periods?.end_date}.
                  Ändra nedan om studenten gör sin LIA vid en annan tid.
                </p>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm mb-1.5">Startar</label>
                  <input type="date" value={start} onChange={e => setStart(e.target.value)} required className={field} />
                </div>
                <div>
                  <label className="block text-sm mb-1.5">Slutar</label>
                  <input type="date" value={end} onChange={e => setEnd(e.target.value)} required className={field} />
                </div>
              </div>
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