'use client'
import { useEffect, useState } from 'react'
import { createClient } from '../../lib/supabase'
import { useRouter } from 'next/navigation'
import Sidebar from '../../components/Sidebar'

const statusText: Record<string, string> = {
  'väntar':  'Väntar på godkännande',
  'godkänd': 'Godkänd',
  'pausad':  'Pausad',
  'avvisad': 'Avvisad',
}

const statusStyle: Record<string, string> = {
  'väntar':  'bg-warn/10 text-warn',
  'godkänd': 'bg-ok/10 text-ok',
  'pausad':  'bg-muted/10 text-muted',
  'avvisad': 'bg-alert/10 text-alert',
}

export default function AdminPage() {
  const [profile, setProfile]       = useState<any>(null)
  const [educations, setEducations] = useState<any[]>([])
  const [stats, setStats]           = useState<any>({})
  const [loading, setLoading]       = useState(true)
  const [busy, setBusy]             = useState('')
  const [error, setError]           = useState('')
  const [open, setOpen]             = useState('')
  const [avtal, setAvtal]           = useState('')
  const [note, setNote]             = useState('')

  const supabase = createClient()
  const router   = useRouter()

  useEffect(() => { load() }, [])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: prof } = await supabase
      .from('profiles').select('*').eq('id', user.id).single()
    setProfile(prof)

    if (!prof?.is_admin) { setLoading(false); return }

    const { data: edus } = await supabase
      .from('educations')
      .select('*, profiles:user_id(full_name, email)')
      .order('created_at', { ascending: false })
    setEducations(edus || [])

    // Räkna per utbildning
    const ids = (edus || []).map(e => e.id)
    const räkning: any = {}

    if (ids.length) {
      const { data: cls } = await supabase
        .from('classes').select('id, education_id').in('education_id', ids)

      for (const c of cls || []) {
        räkning[c.education_id] = räkning[c.education_id] || { klasser: 0, studenter: 0 }
        räkning[c.education_id].klasser++
      }

      const classIds = (cls || []).map(c => c.id)
      if (classIds.length) {
        const { data: studs } = await supabase
          .from('students').select('class_id').in('class_id', classIds)

        for (const s of studs || []) {
          const eduId = (cls || []).find(c => c.id === s.class_id)?.education_id
          if (eduId && räkning[eduId]) räkning[eduId].studenter++
        }
      }
    }

    setStats(räkning)
    setLoading(false)
  }

  async function sattStatus(id: string, status: string) {
    setBusy(id)
    setError('')

    const payload: any = { status }
    if (status === 'godkänd') {
      payload.godkand_av  = profile.id
      payload.godkand_at  = new Date().toISOString()
      if (avtal) payload.avtal_tecknat = avtal
    }
    if (note.trim()) payload.admin_note = note.trim()

    const { error: err } = await supabase
      .from('educations').update(payload).eq('id', id)

    setBusy('')
    if (err) { setError(err.message); return }

    setOpen(''); setAvtal(''); setNote('')
    load()
  }

  const field = 'w-full bg-paper border border-line rounded-lg px-4 py-2.5 text-sm outline-none focus:border-text/40 transition'
  const vantar = educations.filter(e => e.status === 'väntar')

  if (loading) return (
    <div className="min-h-screen bg-paper flex items-center justify-center">
      <p className="text-muted text-sm">Laddar</p>
    </div>
  )

  if (!profile?.is_admin) return (
    <div className="min-h-screen bg-paper flex items-center justify-center p-4">
      <div className="bg-card border border-line rounded-xl p-8 max-w-md text-center text-text">
        <p className="mb-1">Ingen åtkomst</p>
        <p className="text-muted text-sm mb-5">
          Den här sidan är endast för plattformsadministratörer.
        </p>
        <a href="/dashboard/education" className="inline-block bg-text text-paper rounded-full px-6 py-2.5 text-sm font-medium">
          Till din dashboard
        </a>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-paper text-text flex flex-col lg:flex-row">
      <Sidebar role="education" name={profile?.full_name} subtitle="Administratör" />

      <main className="flex-1 p-5 sm:p-8 max-w-4xl">
        <h1 className="text-2xl sm:text-3xl mb-1">Anslutna utbildningar</h1>
        <p className="text-muted text-sm mb-7">
          En utbildning kan inte skapa klasser förrän den godkänts. Godkänn först
          när biträdesavtalet är påskrivet.
        </p>

        {error && (
          <p className="bg-alert/10 border border-alert/25 text-alert text-sm rounded-lg px-4 py-3 mb-5">
            {error}
          </p>
        )}

        {vantar.length > 0 && (
          <div className="bg-warn/8 border border-warn/25 rounded-xl px-5 py-4 mb-6">
            <p className="text-sm">
              <strong>{vantar.length} {vantar.length === 1 ? 'utbildning väntar' : 'utbildningar väntar'}</strong> på
              godkännande.
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-7">
          {[
            { n: educations.length,                                       label: 'utbildningar totalt' },
            { n: educations.filter(e => e.status === 'godkänd').length,   label: 'godkända' },
            { n: vantar.length,                                            label: 'väntar' },
            { n: Object.values(stats).reduce((a: any, s: any) => a + s.studenter, 0), label: 'studenter totalt' },
          ].map((s, i) => (
            <div key={i} className="bg-card border border-line rounded-xl p-5">
              <p className="font-display text-3xl font-extrabold">{s.n as any}</p>
              <p className="text-muted text-sm mt-1 leading-snug">{s.label}</p>
            </div>
          ))}
        </div>

        {educations.length === 0 ? (
          <div className="bg-card border border-line rounded-xl p-12 text-center">
            <p className="mb-1">Inga utbildningar än</p>
            <p className="text-muted text-sm">
              Utbildningar dyker upp här när någon registrerar sig som utbildningsledare.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {educations.map(e => {
              const s = stats[e.id] || { klasser: 0, studenter: 0 }
              return (
                <article key={e.id} className="bg-card border border-line rounded-xl p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="text-base">{e.school_name}</h2>
                      <p className="text-muted text-sm mt-0.5">
                        {e.program_name}{e.city ? ', ' + e.city : ''}
                      </p>
                      <p className="text-muted text-sm mt-1">
                        {e.profiles?.full_name}, {e.profiles?.email}
                      </p>
                      <p className="text-muted text-sm mt-1">
                        {s.klasser} {s.klasser === 1 ? 'klass' : 'klasser'}, {s.studenter} {s.studenter === 1 ? 'student' : 'studenter'}
                      </p>
                      {e.avtal_tecknat && (
                        <p className="text-muted text-sm mt-1">
                          Biträdesavtal tecknat {e.avtal_tecknat}
                        </p>
                      )}
                      {e.admin_note && (
                        <p className="text-sm mt-2 leading-relaxed">{e.admin_note}</p>
                      )}
                    </div>

                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusStyle[e.status]}`}>
                        {statusText[e.status]}
                      </span>
                      <button
                        onClick={() => { setOpen(open === e.id ? '' : e.id); setAvtal(e.avtal_tecknat || ''); setNote(e.admin_note || '') }}
                        className="text-muted hover:text-text text-sm transition"
                      >
                        {open === e.id ? 'Stäng' : 'Hantera'}
                      </button>
                    </div>
                  </div>

                  {open === e.id && (
                    <div className="border-t border-line mt-4 pt-4 space-y-4">
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm mb-1.5">Biträdesavtal tecknat</label>
                          <input type="date" value={avtal} onChange={ev => setAvtal(ev.target.value)} className={field} />
                        </div>
                        <div>
                          <label className="block text-sm mb-1.5">Anteckning</label>
                          <input value={note} onChange={ev => setNote(ev.target.value)} placeholder="Kontaktperson, villkor, annat" className={field} />
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {e.status !== 'godkänd' && (
                          <button
                            onClick={() => sattStatus(e.id, 'godkänd')}
                            disabled={busy === e.id || !avtal}
                            className="bg-ok text-white rounded-full px-5 py-2 text-sm font-medium hover:opacity-85 transition disabled:opacity-30"
                          >
                            Godkänn
                          </button>
                        )}
                        {e.status === 'godkänd' && (
                          <button
                            onClick={() => sattStatus(e.id, 'pausad')}
                            disabled={busy === e.id}
                            className="border border-line rounded-full px-5 py-2 text-sm text-muted hover:border-text/30 transition"
                          >
                            Pausa
                          </button>
                        )}
                        {e.status !== 'avvisad' && (
                          <button
                            onClick={() => sattStatus(e.id, 'avvisad')}
                            disabled={busy === e.id}
                            className="border border-alert/40 text-alert rounded-full px-5 py-2 text-sm hover:bg-alert/5 transition"
                          >
                            Avvisa
                          </button>
                        )}
                        {e.status === 'godkänd' && (
                          <button
                            onClick={() => sattStatus(e.id, 'godkänd')}
                            disabled={busy === e.id}
                            className="border border-line rounded-full px-5 py-2 text-sm text-muted hover:border-text/30 transition"
                          >
                            Spara ändringar
                          </button>
                        )}
                      </div>

                      {!avtal && e.status !== 'godkänd' && (
                        <p className="text-muted text-sm">
                          Ange datum för biträdesavtalet innan du godkänner.
                        </p>
                      )}
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
