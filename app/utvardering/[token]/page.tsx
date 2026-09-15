'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

const skala = ['mycket bra', 'bra', 'godkänt', 'dåligt']

const foretagsfragor = [
  { key: 'q1_handledarinsats', text: 'Hur värderar ni er egen insats som studentens handledare?' },
  { key: 'q2_information',     text: 'Hur har informationen om utbildningen varit?' },
]

const studentfragor = [
  { key: 'q3_initiativ',    text: 'Studentens initiativförmåga' },
  { key: 'q4_samarbete',    text: 'Samarbetsförmåga och servicemedvetenhet' },
  { key: 'q5_planera',      text: 'Förmåga att planera och prioritera' },
  { key: 'q6_strukturera',  text: 'Förmåga att strukturera uppgifter' },
  { key: 'q7_analytisk',    text: 'Analytisk förmåga' },
  { key: 'q8_sjalvstandig', text: 'Förmåga att arbeta självständigt' },
  { key: 'q9a_skriftligt',  text: 'Kommunikationsförmåga, skriftligt' },
  { key: 'q9b_muntligt',    text: 'Kommunikationsförmåga, muntligt' },
  { key: 'q10_lamplighet',  text: 'Lämplighet för yrkesrollen' },
  { key: 'q11_uppforande',  text: 'Uppförande, till exempel punktlighet och ordning' },
  { key: 'q12_redovisning', text: 'Muntlig redovisning av LIA-rapporten' },
]

export default function Utvardering() {
  const { token } = useParams<{ token: string }>()
  const [ev, setEv]         = useState<any>(null)
  const [status, setStatus] = useState('laddar')
  const [svar, setSvar]     = useState<Record<string, string>>({})
  const [name, setName]     = useState('')
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  useEffect(() => {
    async function load() {
      const res  = await fetch('/api/utvardering?token=' + token)
      const data = await res.json()
      if (!res.ok) { setStatus(data.error === 'besvarad' ? 'besvarad' : 'ogiltig'); return }
      setEv(data.evaluation)
      setName(data.evaluation.handledare_name || '')
      setStatus('ok')
    }
    load()
  }, [token])

  const alla = [...foretagsfragor, ...studentfragor]
  const kvar = alla.filter(f => !svar[f.key]).length

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')

    const res = await fetch('/api/utvardering', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, ...svar, handledare_name: name, comment }),
    })
    const data = await res.json()
    setSaving(false)

    if (!res.ok) { setError(data.error || 'Något gick fel'); return }
    setStatus('klar')
  }

  function Fraga({ f, i }: { f: any; i: number }) {
    return (
      <div className="py-4 border-b border-line last:border-0">
        <p className="text-sm mb-3">
          <span className="text-muted mr-2">{i}.</span>{f.text}
        </p>
        <div className="flex flex-wrap gap-2">
          {skala.map(v => (
            <button
              key={v}
              type="button"
              onClick={() => setSvar({ ...svar, [f.key]: v })}
              className={`px-4 py-2 rounded-full text-sm transition ${
                svar[f.key] === v
                  ? 'bg-text text-paper'
                  : 'bg-paper border border-line text-muted hover:border-text/30'
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>
    )
  }

  const meddelanden: Record<string, string> = {
    ogiltig:  'Länken stämmer inte. Kontakta utbildningsledaren för en ny.',
    besvarad: 'Utvärderingen är redan inskickad. Tack!',
  }

  if (status === 'laddar') return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-white/50 text-sm">Laddar</p>
    </div>
  )

  if (status === 'ogiltig' || status === 'besvarad') return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-card rounded-2xl p-8 max-w-md w-full text-center text-text">
        <p className="font-display font-extrabold text-xl mb-3">
          LIA<span className="text-accent">link</span>
        </p>
        <p className="text-muted text-sm">{meddelanden[status]}</p>
      </div>
    </div>
  )

  if (status === 'klar') return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-card rounded-2xl p-8 max-w-md w-full text-center text-text">
        <p className="font-display font-extrabold text-xl mb-4">
          LIA<span className="text-accent">link</span>
        </p>
        <h1 className="text-xl mb-2">Tack för er utvärdering</h1>
        <p className="text-muted text-sm leading-relaxed">
          Svaren har skickats till utbildningsledaren. Ni behöver inte göra något mer.
        </p>
      </div>
    </div>
  )

  const p   = ev.placements
  const edu = p?.lia_periods?.classes?.educations

  return (
    <div className="min-h-screen py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <p className="font-display font-extrabold text-xl text-white mb-6">
          LIA<span className="text-accent">link</span>
        </p>

        <div className="bg-card rounded-2xl p-6 sm:p-8 text-text">
          <h1 className="text-2xl mb-1">Utvärdering efter LIA</h1>
          <p className="text-muted text-sm leading-relaxed mb-6">
            {edu?.school_name} ber er som handledare svara på hur perioden gått.
            Det tar ett par minuter och svaren går direkt till utbildningsledaren.
          </p>

          <div className="bg-paper border border-line rounded-xl p-5 mb-6 text-sm space-y-1">
            <p><span className="text-muted">Student</span>  {p?.students?.profiles?.full_name}</p>
            <p><span className="text-muted">Företag</span>  {p?.companies?.company_name}</p>
            <p><span className="text-muted">Utbildning</span>  {edu?.program_name}</p>
            <p><span className="text-muted">Period</span>  {p?.actual_start || p?.lia_periods?.start_date} till {p?.actual_end || p?.lia_periods?.end_date}</p>
          </div>

          {error && (
            <p className="bg-alert/10 border border-alert/25 text-alert text-sm rounded-lg px-4 py-3 mb-5">
              {error}
            </p>
          )}

          <form onSubmit={submit}>
            <div className="mb-6">
              <label className="block text-sm mb-1.5">Ert namn</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                required
                className="w-full bg-paper border border-line rounded-lg px-4 py-2.5 text-sm outline-none focus:border-text/40 transition"
              />
            </div>

            <h2 className="text-base mb-1">Om samarbetet</h2>
            <p className="text-muted text-sm mb-2">
              De här två frågorna hjälper oss bli bättre mot er.
            </p>
            <div className="mb-7">
              {foretagsfragor.map((f, i) => <Fraga key={f.key} f={f} i={i + 1} />)}
            </div>

            <h2 className="text-base mb-1">Om studenten</h2>
            <p className="text-muted text-sm mb-2">
              Svaren används i studentens bedömning av LIA-kursen.
            </p>
            <div className="mb-7">
              {studentfragor.map((f, i) => <Fraga key={f.key} f={f} i={i + 3} />)}
            </div>

            <div className="mb-6">
              <label className="block text-sm mb-1.5">Kommentarer</label>
              <textarea
                value={comment}
                onChange={e => setComment(e.target.value)}
                rows={4}
                placeholder="Något ni vill lyfta fram eller som inte fångas av frågorna"
                className="w-full bg-paper border border-line rounded-lg px-4 py-2.5 text-sm outline-none focus:border-text/40 transition resize-y"
              />
            </div>

            {kvar > 0 && (
              <p className="text-muted text-sm mb-3">
                {kvar} {kvar === 1 ? 'fråga' : 'frågor'} kvar att besvara.
              </p>
            )}

            <button
              type="submit"
              disabled={saving || kvar > 0}
              className="w-full bg-text text-paper rounded-full py-3.5 text-sm font-medium hover:opacity-85 transition disabled:opacity-30"
            >
              {saving ? 'Skickar' : 'Skicka utvärdering'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}