'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '../../lib/supabase'

export default function IntresseSvar() {
  const { token } = useParams<{ token: string }>()
  const [rad, setRad]       = useState<any>(null)
  const [status, setStatus] = useState('laddar')
  const [svar, setSvar]     = useState('')
  const [antal, setAntal]   = useState('1')
  const [namn, setNamn]     = useState('')
  const [komm, setKomm]     = useState('')
  const [busy, setBusy]     = useState(false)
  const [error, setError]   = useState('')

  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('intressesvar')
        .select(`*,
          education_partners(companies(company_name)),
          intresseforfragan(stangd, lia_periods(name, start_date, end_date, weeks),
            educations(program_name, school_name))`)
        .eq('token', token)
        .maybeSingle()

      if (!data)                 { setStatus('ogiltig'); return }
      if (data.svarat_at)        { setStatus('besvarad'); return }
      if ((data as any).intresseforfragan?.stangd) { setStatus('stangd'); return }

      setRad(data)
      setStatus('ok')
    }
    load()
  }, [token])

  async function skicka(valt: string) {
    setBusy(true)
    setError('')

    const { error: err } = await supabase
      .from('intressesvar')
      .update({
        svar: valt,
        antal: valt === 'nej' ? null : parseInt(antal) || 1,
        kommentar: komm.trim() || null,
        kontakt_namn: namn.trim() || null,
        svarat_at: new Date().toISOString(),
      })
      .eq('token', token)

    setBusy(false)
    if (err) { setError(err.message); return }
    setSvar(valt)
    setStatus('klar')
  }

  const f    = rad?.intresseforfragan
  const per  = f?.lia_periods
  const edu  = f?.educations
  const co   = rad?.education_partners?.companies

  const meddelanden: Record<string, string> = {
    ogiltig:  'Länken stämmer inte. Kontakta utbildningsledaren för en ny.',
    besvarad: 'Ni har redan svarat på den här förfrågan. Tack!',
    stangd:   'Förfrågan är stängd. Hör gärna av er direkt till utbildningsledaren.',
  }

  const fald = 'w-full border border-line rounded-lg px-4 py-2.5 text-sm outline-none focus:border-text/40 transition'

  if (status === 'laddar') return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-white/50 text-sm">Laddar</p>
    </div>
  )

  if (status === 'ogiltig' || status === 'besvarad' || status === 'stangd') return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-card rounded-2xl p-8 max-w-md w-full text-center text-text">
        <p className="font-display font-extrabold text-xl mb-3">
          LIA<span className="text-accent">link</span>
        </p>
        <p className="text-muted text-sm leading-relaxed">{meddelanden[status]}</p>
      </div>
    </div>
  )

  if (status === 'klar') return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-card rounded-2xl p-8 max-w-md w-full text-center text-text">
        <p className="font-display font-extrabold text-xl mb-4">
          LIA<span className="text-accent">link</span>
        </p>
        <h1 className="text-xl mb-2">Tack för svaret</h1>
        <p className="text-muted text-sm leading-relaxed">
          {svar === 'ja'
            ? 'Utbildningsledaren hör av sig med nästa steg.'
            : svar === 'kanske'
            ? 'Vi hör av oss närmare perioden för att stämma av.'
            : 'Tack för att ni svarade. Vi hör av oss inför nästa period i stället.'}
        </p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen py-10 px-4">
      <div className="max-w-xl mx-auto">
        <p className="font-display font-extrabold text-xl text-white mb-6">
          LIA<span className="text-accent">link</span>
        </p>

        <div className="bg-card rounded-2xl p-6 sm:p-8 text-text">
          <h1 className="text-2xl mb-2">Kan ni ta emot en LIA-studerande?</h1>
          <p className="text-muted text-sm leading-relaxed mb-6">
            {edu?.school_name} planerar nästa LIA-period för {edu?.program_name}.
            Ni binder er inte till något genom att svara ja.
          </p>

          <div className="bg-paper border border-line rounded-xl p-5 mb-6 text-sm space-y-1">
            <p><span className="text-muted">Företag</span>  {co?.company_name}</p>
            <p><span className="text-muted">Utbildning</span>  {edu?.program_name}</p>
            {per && (
              <p>
                <span className="text-muted">Period</span>  {per.name}, {per.start_date} till {per.end_date}
                {per.weeks ? `, ${per.weeks} veckor` : ''}
              </p>
            )}
          </div>

          {error && (
            <p className="bg-alert/10 border border-alert/25 text-alert text-sm rounded-lg px-4 py-3 mb-5">
              {error}
            </p>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm mb-1.5">Ert namn</label>
              <input value={namn} onChange={e => setNamn(e.target.value)} placeholder="Anna Andersson" className={fald} />
            </div>

            <div>
              <label className="block text-sm mb-1.5">Antal platser</label>
              <input type="number" min="1" max="10" value={antal} onChange={e => setAntal(e.target.value)} className={fald + ' max-w-28'} />
              <p className="text-muted text-xs mt-1.5">Gäller om ni svarar ja eller kanske.</p>
            </div>

            <div>
              <label className="block text-sm mb-1.5">Kommentar</label>
              <textarea value={komm} onChange={e => setKomm(e.target.value)} rows={3}
                placeholder="Något vi bör veta? Inriktning, period, kontaktperson."
                className={fald + ' resize-y'} />
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-3 mt-6">
            <button onClick={() => skicka('ja')} disabled={busy}
              className="bg-ok text-white rounded-full py-3 text-sm font-medium hover:opacity-85 transition disabled:opacity-40">
              Ja, vi kan ta emot
            </button>
            <button onClick={() => skicka('kanske')} disabled={busy}
              className="bg-warn text-white rounded-full py-3 text-sm font-medium hover:opacity-85 transition disabled:opacity-40">
              Kanske, hör av er
            </button>
            <button onClick={() => skicka('nej')} disabled={busy}
              className="border border-line text-muted rounded-full py-3 text-sm hover:border-text/30 transition disabled:opacity-40">
              Nej, inte denna gång
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}