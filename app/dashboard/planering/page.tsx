'use client'
import { useEffect, useState } from 'react'
import { createClient } from '../../lib/supabase'
import { useRouter } from 'next/navigation'
import Sidebar from '../../components/Sidebar'
import { useEdu } from '../../components/EduContext'

export default function PlaneringPage() {
  const [profile, setProfile] = useState<any>(null)
  const [classes, setClasses] = useState<any[]>([])
  const [periods, setPeriods] = useState<any[]>([])
  const [counts, setCounts]   = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  // Klassformulär
  const [klassForm, setKlassForm] = useState<any>(null)

  // Periodformulär
  const [periodForm, setPeriodForm] = useState<any>(null)

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

    const { data: cls } = await supabase
      .from('classes').select('*').eq('education_id', current.id)
      .order('start_date', { ascending: false })
    setClasses(cls || [])

    const ids = (cls || []).map(c => c.id)
    if (ids.length) {
      const { data: per } = await supabase
        .from('lia_periods').select('*').in('class_id', ids).order('sequence')
      setPeriods(per || [])

      const { data: studs } = await supabase
        .from('students').select('class_id').in('class_id', ids)
      const map: Record<string, number> = {}
      for (const s of studs || []) {
        if (s.class_id) map[s.class_id] = (map[s.class_id] || 0) + 1
      }
      setCounts(map)
    } else {
      setPeriods([])
      setCounts({})
    }
    setLoading(false)
  }

  function nyKlass() {
    setKlassForm({ id: null, name: '', yh_kod: '', termin: '', start_date: '', end_date: '' })
    setError('')
  }

  function redigeraKlass(c: any) {
    setKlassForm({
      id: c.id, name: c.name || '', yh_kod: c.yh_kod || '',
      termin: c.termin || '', start_date: c.start_date || '', end_date: c.end_date || '',
    })
    setError('')
  }

  async function sparaKlass(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const payload = {
      education_id: current.id,
      name:       klassForm.name.trim(),
      yh_kod:     klassForm.yh_kod.trim(),
      termin:     klassForm.termin.trim() || null,
      start_date: klassForm.start_date || null,
      end_date:   klassForm.end_date || null,
    }

    const { error: err } = klassForm.id
      ? await supabase.from('classes').update(payload).eq('id', klassForm.id)
      : await supabase.from('classes').insert(payload)

    if (err) {
      setError(err.message.includes('duplicate')
        ? 'YH-koden används redan av en annan klass.'
        : err.message)
      return
    }

    setKlassForm(null)
    load()
  }

  function nyPeriod(classId: string) {
    const antal = periods.filter(p => p.class_id === classId).length
    setPeriodForm({
      id: null, class_id: classId,
      name: `LIA ${antal + 1}`, sequence: antal + 1,
      start_date: '', end_date: '',
    })
    setError('')
  }

  function redigeraPeriod(p: any) {
    setPeriodForm({
      id: p.id, class_id: p.class_id, name: p.name,
      sequence: p.sequence, start_date: p.start_date, end_date: p.end_date,
    })
    setError('')
  }

  async function sparaPeriod(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const veckor = periodForm.start_date && periodForm.end_date
      ? Math.round((new Date(periodForm.end_date).getTime() - new Date(periodForm.start_date).getTime()) / (1000*60*60*24*7))
      : null

    const payload = {
      class_id:   periodForm.class_id,
      name:       periodForm.name.trim(),
      sequence:   periodForm.sequence,
      start_date: periodForm.start_date,
      end_date:   periodForm.end_date,
      weeks:      veckor,
    }

    const { error: err } = periodForm.id
      ? await supabase.from('lia_periods').update(payload).eq('id', periodForm.id)
      : await supabase.from('lia_periods').insert(payload)

    if (err) { setError(err.message); return }

    setPeriodForm(null)
    load()
  }

  async function taBortPeriod(id: string) {
    if (!confirm('Ta bort LIA-perioden? Placeringar och avtal kopplade till den försvinner också.')) return
    const { error: err } = await supabase.from('lia_periods').delete().eq('id', id)
    if (err) { setError(err.message); return }
    load()
  }

  const field = 'w-full bg-paper border border-line rounded-lg px-4 py-2.5 text-sm outline-none focus:border-text/40 transition'

  if (loading) return (
    <div className="min-h-screen bg-paper flex items-center justify-center">
      <p className="text-muted text-sm">Laddar</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-paper text-text flex flex-col lg:flex-row">
      <Sidebar role="education" name={profile?.full_name} subtitle={current?.program_name} />

      <main className="flex-1 p-5 sm:p-8 max-w-3xl">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-2">
          <h1 className="text-2xl sm:text-3xl">Klasser och LIA-perioder</h1>
          <button
            onClick={() => klassForm ? setKlassForm(null) : nyKlass()}
            className="bg-accent text-white px-5 py-2.5 rounded-full text-sm font-medium hover:opacity-85 transition"
          >
            {klassForm && !klassForm.id ? 'Avbryt' : 'Ny klass'}
          </button>
        </div>
        <p className="text-muted text-sm mb-7">
          {current?.program_name}. Studenter ansluter sig med klassens YH-kod.
        </p>

        {error && (
          <p className="bg-alert/10 border border-alert/25 text-alert text-sm rounded-lg px-4 py-3 mb-5">{error}</p>
        )}

        {klassForm && (
          <form onSubmit={sparaKlass} className="bg-card border border-line rounded-xl p-6 mb-5 space-y-4">
            <h2 className="text-base">{klassForm.id ? 'Redigera klass' : 'Ny klass'}</h2>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm mb-1.5">Klassens namn</label>
                <input
                  value={klassForm.name}
                  onChange={e => setKlassForm({ ...klassForm, name: e.target.value })}
                  required placeholder="Systemingenjör 4.0" className={field}
                />
                <p className="text-muted text-xs mt-1.5">Undvik förkortningar, andra läser det också.</p>
              </div>
              <div>
                <label className="block text-sm mb-1.5">Termin</label>
                <input
                  value={klassForm.termin}
                  onChange={e => setKlassForm({ ...klassForm, termin: e.target.value })}
                  placeholder="HT25" className={field}
                />
                <p className="text-muted text-xs mt-1.5">Skiljer omgångarna åt.</p>
              </div>
            </div>

            <div>
              <label className="block text-sm mb-1.5">YH-kod</label>
              <input
                value={klassForm.yh_kod}
                onChange={e => setKlassForm({ ...klassForm, yh_kod: e.target.value })}
                required placeholder="YH01234-2025" className={field}
              />
              <p className="text-muted text-xs mt-1.5">Unik per omgång. Den här delar du med studenterna.</p>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm mb-1.5">Utbildningen startar</label>
                <input type="date" value={klassForm.start_date}
                  onChange={e => setKlassForm({ ...klassForm, start_date: e.target.value })} className={field} />
              </div>
              <div>
                <label className="block text-sm mb-1.5">Utbildningen slutar</label>
                <input type="date" value={klassForm.end_date}
                  onChange={e => setKlassForm({ ...klassForm, end_date: e.target.value })} className={field} />
              </div>
            </div>

            <div className="flex gap-2">
              <button type="submit" className="bg-text text-paper rounded-full px-6 py-2.5 text-sm font-medium hover:opacity-85 transition">
                Spara
              </button>
              <button type="button" onClick={() => setKlassForm(null)} className="text-muted text-sm px-4">
                Avbryt
              </button>
            </div>
          </form>
        )}

        {classes.length === 0 && !klassForm ? (
          <div className="bg-card border border-line rounded-xl p-12 text-center">
            <p className="mb-1">Inga klasser upplagda</p>
            <p className="text-muted text-sm">
              Lägg upp din första klass så kan studenter ansluta med YH-koden.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {classes.map(c => {
              const mina = periods.filter(p => p.class_id === c.id)
              return (
                <section key={c.id} className="bg-card border border-line rounded-xl overflow-hidden">
                  <div className="p-6 pb-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="text-lg">
                          {c.name}{c.termin ? `, ${c.termin}` : ''}
                        </h2>
                        <p className="text-muted text-sm mt-0.5">
                          {counts[c.id] || 0} {counts[c.id] === 1 ? 'student' : 'studenter'}
                          {c.start_date && `, ${c.start_date} till ${c.end_date || 'pågår'}`}
                        </p>
                      </div>
                      <div className="flex items-start gap-3 shrink-0">
                        <div className="bg-paper border border-line rounded-lg px-3 py-2">
                          <p className="text-muted text-xs">YH-kod</p>
                          <p className="text-sm font-medium">{c.yh_kod}</p>
                        </div>
                        <button onClick={() => redigeraKlass(c)} className="text-muted hover:text-text text-sm transition mt-2">
                          Redigera
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-line">
                    {mina.length === 0 ? (
                      <p className="text-muted text-sm px-6 py-4">
                        Inga LIA-perioder upplagda.
                      </p>
                    ) : (
                      <ul className="divide-y divide-line">
                        {mina.map(p => (
                          <li key={p.id} className="px-6 py-3.5 flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <span className="text-sm font-medium">{p.name}</span>
                              <span className="text-muted text-sm ml-3">
                                {p.start_date} till {p.end_date}
                                {p.weeks ? `, ${p.weeks} veckor` : ''}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <button onClick={() => redigeraPeriod(p)} className="text-muted hover:text-text text-sm transition">
                                Redigera
                              </button>
                              <button onClick={() => taBortPeriod(p.id)} className="text-muted hover:text-alert text-sm transition">
                                Ta bort
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="border-t border-line p-5 bg-paper/50">
                    {periodForm && periodForm.class_id === c.id ? (
                      <form onSubmit={sparaPeriod} className="space-y-4">
                        <div className="grid sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm mb-1.5">Periodens namn</label>
                            <input
                              value={periodForm.name}
                              onChange={e => setPeriodForm({ ...periodForm, name: e.target.value })}
                              required placeholder="LIA 1" className={field}
                            />
                          </div>
                          <div>
                            <label className="block text-sm mb-1.5">Ordning</label>
                            <input
                              type="number" min="1"
                              value={periodForm.sequence}
                              onChange={e => setPeriodForm({ ...periodForm, sequence: parseInt(e.target.value) || 1 })}
                              className={field}
                            />
                            <p className="text-muted text-xs mt-1.5">Styr i vilken ordning perioderna visas.</p>
                          </div>
                        </div>
                        <div className="grid sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm mb-1.5">Startar</label>
                            <input type="date" value={periodForm.start_date}
                              onChange={e => setPeriodForm({ ...periodForm, start_date: e.target.value })}
                              required className={field} />
                          </div>
                          <div>
                            <label className="block text-sm mb-1.5">Slutar</label>
                            <input type="date" value={periodForm.end_date}
                              onChange={e => setPeriodForm({ ...periodForm, end_date: e.target.value })}
                              required className={field} />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button type="submit" className="bg-text text-paper rounded-full px-6 py-2.5 text-sm font-medium hover:opacity-85 transition">
                            Spara period
                          </button>
                          <button type="button" onClick={() => setPeriodForm(null)} className="text-muted text-sm px-4">
                            Avbryt
                          </button>
                        </div>
                      </form>
                    ) : (
                      <button onClick={() => nyPeriod(c.id)} className="text-sm text-muted hover:text-text transition">
                        Lägg till LIA-period
                      </button>
                    )}
                  </div>
                </section>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
