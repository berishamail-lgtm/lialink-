'use client'
import { useEffect, useState } from 'react'
import { createClient } from '../../lib/supabase'
import { useRouter } from 'next/navigation'
import Sidebar from '../../components/Sidebar'
import { useEdu } from '../../components/EduContext'

const skalavarde: Record<string, number> = {
  'mycket bra': 4, 'bra': 3, 'godkänt': 2, 'dåligt': 1,
}

const fragor = [
  { key: 'q1_handledarinsats', text: 'Handledarens egen insats',        grupp: 'oss' },
  { key: 'q2_information',     text: 'Informationen om utbildningen',   grupp: 'oss' },
  { key: 'q3_initiativ',       text: 'Initiativförmåga',                grupp: 'student' },
  { key: 'q4_samarbete',       text: 'Samarbete och service',           grupp: 'student' },
  { key: 'q5_planera',         text: 'Planera och prioritera',          grupp: 'student' },
  { key: 'q6_strukturera',     text: 'Strukturera uppgifter',           grupp: 'student' },
  { key: 'q7_analytisk',       text: 'Analytisk förmåga',               grupp: 'student' },
  { key: 'q8_sjalvstandig',    text: 'Arbeta självständigt',            grupp: 'student' },
  { key: 'q9a_skriftligt',     text: 'Kommunikation, skriftligt',       grupp: 'student' },
  { key: 'q9b_muntligt',       text: 'Kommunikation, muntligt',         grupp: 'student' },
  { key: 'q10_lamplighet',     text: 'Lämplighet för yrkesrollen',      grupp: 'student' },
  { key: 'q11_uppforande',     text: 'Uppförande',                      grupp: 'student' },
  { key: 'q12_redovisning',    text: 'Muntlig LIA-redovisning',         grupp: 'student' },
]

export default function UtvarderingarPage() {
  const [klart, setKlart] = useState('')
  const [profile, setProfile]     = useState<any>(null)
  const [education, setEducation] = useState<any>(null)
  const [rows, setRows]           = useState<any[]>([])
  const [loading, setLoading]     = useState(true)
  const [busy, setBusy]           = useState('')
  const [error, setError]         = useState('')
  const [open, setOpen]           = useState('')

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
              students(profiles(full_name)),
              companies(company_name),
              evaluations(*)
            `)
            .in('lia_period_id', periodIds)
            .not('company_id', 'is', null)
          setRows(pl || [])
        }
      }
    }
    setLoading(false)
  }

  async function skicka(placementId: string, paminnelse = false) {
    setBusy(placementId)
    setError('')
    const res = await fetch('/api/skicka-utvardering', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ placementId, paminnelse }),
    })
    const data = await res.json()
    setBusy('')
    if (!res.ok) { setError(data.error || 'Kunde inte skicka'); return }
    setKlart(paminnelse
      ? 'Påminnelse skickad till ' + data.email
      : 'Utvärdering skickad till ' + data.email)
    load()
  }

  function evalAv(r: any) {
    return Array.isArray(r.evaluations) ? r.evaluations[0] : r.evaluations
  }

  const besvarade = rows
    .map(r => evalAv(r))
    .filter(e => e && e.status === 'besvarat')

  function snitt(key: string): number | null {
    const varden = besvarade
      .map(e => skalavarde[e[key]])
      .filter(Boolean)
    if (!varden.length) return null
    return Math.round((varden.reduce((a, b) => a + b, 0) / varden.length) * 10) / 10
  }

  function snittFarg(v: number | null) {
    if (v === null) return 'text-muted'
    if (v >= 3.5) return 'text-ok'
    if (v >= 2.5) return 'text-text'
    return 'text-alert'
  }
  function laddaNer() {
    const kolumner = [
      'Student', 'Klass', 'LIA-period', 'Företag', 'Handledare', 'Besvarad',
      ...fragor.map(f => f.text), 'Kommentar',
    ]

    const rader = rows
      .filter(r => evalAv(r)?.status === 'besvarat')
      .map(r => {
        const e = evalAv(r)
        return [
          r.students?.profiles?.full_name || '',
          r.lia_periods?.classes?.name || '',
          r.lia_periods?.name || '',
          r.companies?.company_name || '',
          e.handledare_name || '',
          e.answered_at ? new Date(e.answered_at).toLocaleDateString('sv-SE') : '',
          ...fragor.map(f => e[f.key] || ''),
          (e.comment || '').replace(/\r?\n/g, ' '),
        ]
      })

    if (!rader.length) return

    const csv = [kolumner, ...rader]
      .map(r => r.map(f => '"' + String(f).replace(/"/g, '""') + '"').join(';'))
      .join('\n')

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url
    a.download = 'Utvarderingar-' + (education?.program_name || '').replace(/[^a-zA-ZåäöÅÄÖ0-9]/g, '-') + '-' + new Date().toISOString().slice(0, 10) + '.csv'
    a.click()
    URL.revokeObjectURL(url)
  }
  if (loading) return (
    <div className="min-h-screen bg-paper flex items-center justify-center">
      <p className="text-muted text-sm">Laddar</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-paper text-text flex flex-col lg:flex-row">
      <Sidebar role="education" name={profile?.full_name} subtitle={education?.program_name} />

      <main className="flex-1 p-5 sm:p-8 max-w-4xl">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-1">
          <h1 className="text-2xl sm:text-3xl">Utvärderingar</h1>
          <button
            onClick={laddaNer}
            disabled={!besvarade.length}
            className="border border-line rounded-full px-4 py-2.5 text-sm text-muted hover:border-text/30 transition disabled:opacity-40"
          >
            Ladda ner svaren
          </button>
        </div>
        <p className="text-muted text-sm mb-7">
          Handledarna svarar via en länk, utan inloggning.
        </p>

        {error && (
          <p className="bg-alert/10 border border-alert/25 text-alert text-sm rounded-lg px-4 py-3 mb-5">
            {error}
          </p>
        )}
        {klart && (
          <p className="bg-ok/10 border border-ok/25 text-ok text-sm rounded-lg px-4 py-3 mb-5">{klart}</p>
        )}
        {besvarade.length > 0 && (
          <section className="bg-card border border-line rounded-xl p-6 mb-5">
            <h2 className="text-base mb-1">Sammanställning</h2>
            <p className="text-muted text-sm mb-5">
              Snitt av {besvarade.length} {besvarade.length === 1 ? 'svar' : 'svar'}
              , på skalan dåligt 1 till mycket bra 4.
            </p>

            <p className="text-sm font-medium mb-2">Om oss</p>
            <div className="space-y-2 mb-5">
              {fragor.filter(f => f.grupp === 'oss').map(f => {
                const v = snitt(f.key)
                return (
                  <div key={f.key} className="flex items-baseline justify-between gap-3">
                    <span className="text-sm text-muted">{f.text}</span>
                    <span className={`text-sm font-medium ${snittFarg(v)}`}>
                      {v === null ? '—' : v}
                    </span>
                  </div>
                )
              })}
            </div>

            <p className="text-sm font-medium mb-2">Om studenterna</p>
            <div className="space-y-2">
              {fragor.filter(f => f.grupp === 'student').map(f => {
                const v = snitt(f.key)
                return (
                  <div key={f.key} className="flex items-baseline justify-between gap-3">
                    <span className="text-sm text-muted">{f.text}</span>
                    <span className={`text-sm font-medium ${snittFarg(v)}`}>
                      {v === null ? '—' : v}
                    </span>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {rows.length === 0 ? (
          <div className="bg-card border border-line rounded-xl p-12 text-center">
            <p className="mb-1">Inga placeringar att utvärdera</p>
            <p className="text-muted text-sm">
              Utvärderingar går att skicka när en student har en LIA-plats och ett avtal.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map(r => {
              const ev  = evalAv(r)
              const st  = ev?.status || 'väntar'
              const namn = r.students?.profiles?.full_name

              return (
                <article key={r.id} className="bg-card border border-line rounded-xl p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="text-base">{namn}</h2>
                      <p className="text-muted text-sm mt-0.5">
                        {r.companies?.company_name}, {r.lia_periods?.name}
                        {r.lia_periods?.classes?.name ? `, ${r.lia_periods.classes.name}` : ''}
                      </p>
                      {ev?.answered_at && (
                        <p className="text-muted text-sm">
                          Besvarad {new Date(ev.answered_at).toLocaleDateString('sv-SE')}
                          {ev.handledare_name ? ` av ${ev.handledare_name}` : ''}
                        </p>
                      )}
                      {st === 'skickat' && ev?.sent_at && (
                        <p className="text-muted text-sm">
                          Skickad {new Date(ev.sent_at).toLocaleDateString('sv-SE')}
                          {ev.reminded_at ? ', påmind' : ''}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                        st === 'besvarat' ? 'bg-ok/10 text-ok'
                        : st === 'skickat' ? 'bg-warn/10 text-warn'
                        : 'bg-muted/10 text-muted'
                      }`}>
                        {st === 'besvarat' ? 'Besvarad' : st === 'skickat' ? 'Väntar på svar' : 'Ej skickad'}
                      </span>

                      {st === 'väntar' && (
                        <button
                          onClick={() => skicka(r.id)}
                          disabled={busy === r.id}
                          className="bg-text text-paper rounded-full px-4 py-1.5 text-sm font-medium hover:opacity-85 transition disabled:opacity-40"
                        >
                          {busy === r.id ? 'Skickar' : 'Skicka'}
                        </button>
                      )}

                      {st === 'skickat' && (
                        <button
                          onClick={() => skicka(r.id, true)}
                          disabled={busy === r.id}
                          className="border border-line rounded-full px-4 py-1.5 text-sm text-muted hover:border-text/30 transition disabled:opacity-40"
                        >
                          {busy === r.id ? 'Skickar' : 'Påminn'}
                        </button>
                      )}

                      {st === 'besvarat' && (
                        <>
                          <button
                            onClick={() => setOpen(open === r.id ? '' : r.id)}
                            className="text-muted hover:text-text text-sm transition"
                          >
                            {open === r.id ? 'Dölj svar' : 'Visa svar'}
                          </button>
                          <a href={`/api/utvardering-pdf?id=${ev.id}`} target="_blank" rel="noopener" className="text-muted hover:text-text text-sm transition">
                            Ladda ner PDF
                          </a>
                        </>
                      )}
                    </div>
                  </div>

                  {open === r.id && ev && (
                    <div className="border-t border-line mt-4 pt-4 space-y-2">
                      {fragor.map(f => (
                        <div key={f.key} className="flex items-baseline justify-between gap-3">
                          <span className="text-sm text-muted">{f.text}</span>
                          <span className="text-sm">{ev[f.key] || '—'}</span>
                        </div>
                      ))}
                      {ev.comment && (
                        <div className="bg-paper border border-line rounded-lg p-4 mt-3">
                          <p className="text-muted text-xs mb-1">Kommentar</p>
                          <p className="text-sm leading-relaxed">{ev.comment}</p>
                        </div>
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
