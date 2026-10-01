'use client'
import { useEffect, useState } from 'react'
import { createClient } from '../../../lib/supabase'
import { useRouter } from 'next/navigation'
import AdminSidebar from '../../../components/AdminSidebar'

const statusText: Record<string, string> = {
  'väntar':  'Väntar på godkännande',
  'godkänd': 'Godkänd',
  'pausad':  'Pausad',
  'avvisad': 'Avvisad',
}

const statusStil: Record<string, string> = {
  'väntar':  'bg-warn/10 text-warn',
  'godkänd': 'bg-ok/10 text-ok',
  'pausad':  'bg-muted/10 text-muted',
  'avvisad': 'bg-alert/10 text-alert',
}

export default function AdminPage() {
  const [profile, setProfile]      = useState<any>(null)
  const [skolor, setSkolor]        = useState<any[]>([])
  const [utbildningar, setUtb]     = useState<Record<string, any[]>>({})
  const [antalStudenter, setAntal] = useState<Record<string, number>>({})
  const [loading, setLoading]      = useState(true)
  const [busy, setBusy]            = useState('')
  const [error, setError]          = useState('')
  const [oppen, setOppen]          = useState('')
  const [avtal, setAvtal]          = useState('')
  const [note, setNote]            = useState('')

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

    const { data: sk } = await supabase
      .from('schools').select('*').order('created_at', { ascending: false })
    setSkolor(sk || [])

    const { data: edus } = await supabase
      .from('educations')
      .select('*, profiles:user_id(full_name, email)')
      .order('program_name')

    const um: Record<string, any[]> = {}
    for (const e of edus || []) {
      const nyckel = e.school_id || 'utan'
      um[nyckel] = um[nyckel] || []
      um[nyckel].push(e)
    }
    setUtb(um)

    const eduIds = (edus || []).map(e => e.id)
    if (eduIds.length) {
      const { data: cls } = await supabase
        .from('classes').select('id, education_id').in('education_id', eduIds)
      const classIds = (cls || []).map(c => c.id)

      if (classIds.length) {
        const { data: studs } = await supabase
          .from('students').select('class_id').in('class_id', classIds)

        const per: Record<string, number> = {}
        for (const s of studs || []) {
          const eduId  = (cls || []).find(c => c.id === s.class_id)?.education_id
          const skolId = (edus || []).find(e => e.id === eduId)?.school_id
          if (skolId) per[skolId] = (per[skolId] || 0) + 1
        }
        setAntal(per)
      }
    }

    setLoading(false)
  }

  async function sattStatus(skola: any, status: string) {
    setBusy(skola.id)
    setError('')

    const payload: any = { status }
    if (status === 'godkänd') {
      payload.godkand_av = profile.id
      payload.godkand_at = new Date().toISOString()
      if (avtal) payload.avtal_tecknat = avtal
    }
    if (note.trim()) payload.admin_note = note.trim()

    const { error: err } = await supabase
      .from('schools').update(payload).eq('id', skola.id)

    if (err) { setError(err.message); setBusy(''); return }

    await supabase.from('educations')
      .update({ status })
      .eq('school_id', skola.id)

    setBusy('')
    setOppen(''); setAvtal(''); setNote('')
    load()
  }

  const field = 'w-full bg-paper border border-line rounded-lg px-4 py-2.5 text-sm outline-none focus:border-text/40 transition'
  const vantar = skolor.filter(s => s.status === 'väntar')
  const utanSkola = utbildningar['utan'] || []

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
      <AdminSidebar name={profile?.full_name} />

      <main className="flex-1 p-5 sm:p-8 max-w-4xl">
        <h1 className="text-2xl sm:text-3xl mb-1">Anslutna utbildningsanordnare</h1>
        <p className="text-muted text-sm mb-7">
          Avtalet tecknas med anordnaren. Alla deras utbildningar följer skolans status.
        </p>

        {error && (
          <p className="bg-alert/10 border border-alert/25 text-alert text-sm rounded-lg px-4 py-3 mb-5">
            {error}
          </p>
        )}

        {vantar.length > 0 && (
          <div className="bg-warn/8 border border-warn/25 rounded-xl px-5 py-4 mb-6">
            <p className="text-sm">
              <strong>{vantar.length} {vantar.length === 1 ? 'anordnare väntar' : 'anordnare väntar'}</strong> på
              godkännande.
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-7">
          {[
            { n: skolor.length, label: 'anordnare totalt' },
            { n: skolor.filter(s => s.status === 'godkänd').length, label: 'godkända' },
            { n: Object.values(utbildningar).reduce((a, b) => a + b.length, 0), label: 'utbildningar' },
            { n: Object.values(antalStudenter).reduce((a, b) => a + b, 0), label: 'studenter' },
          ].map((s, i) => (
            <div key={i} className="bg-card border border-line rounded-xl p-5">
              <p className="font-display text-3xl font-extrabold">{s.n}</p>
              <p className="text-muted text-sm mt-1 leading-snug">{s.label}</p>
            </div>
          ))}
        </div>

        {skolor.length === 0 ? (
          <div className="bg-card border border-line rounded-xl p-12 text-center">
            <p className="mb-1">Inga anordnare än</p>
            <p className="text-muted text-sm">
              De dyker upp här när någon registrerar en utbildning.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {skolor.map(s => {
              const edus = utbildningar[s.id] || []
              const studenter = antalStudenter[s.id] || 0

              return (
                <article key={s.id} className="bg-card border border-line rounded-xl overflow-hidden">
                  <div className="p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h2 className="text-base">{s.name}</h2>
                          <span className={'rounded-full px-2.5 py-0.5 text-xs font-medium ' + statusStil[s.status]}>
                            {statusText[s.status]}
                          </span>
                        </div>
                        {s.org_number && (
                          <p className="text-muted text-sm mt-0.5">Org.nr {s.org_number}</p>
                        )}
                        <p className="text-muted text-sm mt-1">
                          {edus.length} {edus.length === 1 ? 'utbildning' : 'utbildningar'},
                          {' '}{studenter} {studenter === 1 ? 'student' : 'studenter'}
                        </p>
                        {s.avtal_tecknat && (
                          <p className="text-muted text-sm">
                            Biträdesavtal tecknat {s.avtal_tecknat}
                          </p>
                        )}
                        {s.admin_note && (
                          <p className="text-sm mt-2 leading-relaxed">{s.admin_note}</p>
                        )}
                      </div>

                      <button
                        onClick={() => {
                          setOppen(oppen === s.id ? '' : s.id)
                          setAvtal(s.avtal_tecknat || '')
                          setNote(s.admin_note || '')
                          setError('')
                        }}
                        className="text-muted hover:text-text text-sm transition shrink-0"
                      >
                        {oppen === s.id ? 'Stäng' : 'Hantera'}
                      </button>
                    </div>
                  </div>

                  {oppen === s.id && (
                    <div className="border-t border-line bg-paper/50 p-5 space-y-5">
                      {edus.length > 0 && (
                        <div>
                          <p className="text-sm font-medium mb-2">Utbildningar</p>
                          <div className="border border-line rounded-lg divide-y divide-line bg-card">
                            {edus.map(e => (
                              <div key={e.id} className="px-4 py-3">
                                <p className="text-sm">{e.program_name}</p>
                                <p className="text-muted text-xs mt-0.5">
                                  {e.profiles?.full_name}, {e.profiles?.email}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="grid sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm mb-1.5">Biträdesavtal tecknat</label>
                          <input type="date" value={avtal} onChange={e => setAvtal(e.target.value)} className={field} />
                        </div>
                        <div>
                          <label className="block text-sm mb-1.5">Anteckning</label>
                          <input value={note} onChange={e => setNote(e.target.value)}
                            placeholder="Kontaktperson, villkor, annat" className={field} />
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {s.status !== 'godkänd' && (
                          <button onClick={() => sattStatus(s, 'godkänd')} disabled={busy === s.id || !avtal}
                            className="bg-ok text-white rounded-full px-5 py-2 text-sm font-medium hover:opacity-85 transition disabled:opacity-30">
                            Godkänn
                          </button>
                        )}
                        {s.status === 'godkänd' && (
                          <>
                            <button onClick={() => sattStatus(s, 'godkänd')} disabled={busy === s.id}
                              className="border border-line rounded-full px-5 py-2 text-sm text-muted hover:border-text/30 transition">
                              Spara ändringar
                            </button>
                            <button onClick={() => sattStatus(s, 'pausad')} disabled={busy === s.id}
                              className="border border-line rounded-full px-5 py-2 text-sm text-muted hover:border-text/30 transition">
                              Pausa
                            </button>
                          </>
                        )}
                        {s.status !== 'avvisad' && (
                          <button onClick={() => sattStatus(s, 'avvisad')} disabled={busy === s.id}
                            className="border border-alert/40 text-alert rounded-full px-5 py-2 text-sm hover:bg-alert/5 transition">
                            Avvisa
                          </button>
                        )}
                      </div>

                      {!avtal && s.status !== 'godkänd' && (
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

        {utanSkola.length > 0 && (
          <section className="mt-8">
            <h2 className="text-base mb-1">Utbildningar utan anordnare</h2>
            <p className="text-muted text-sm mb-4">
              Skapade innan anordnare infördes. Behöver kopplas manuellt.
            </p>
            <div className="bg-card border border-line rounded-xl divide-y divide-line">
              {utanSkola.map(e => (
                <div key={e.id} className="px-5 py-4">
                  <p className="text-sm">{e.program_name}</p>
                  <p className="text-muted text-sm mt-0.5">
                    {e.school_name}, {e.profiles?.email}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
