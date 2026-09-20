'use client'
import { useEffect, useState } from 'react'
import { createClient } from '../../lib/supabase'
import { useRouter } from 'next/navigation'
import Sidebar from '../../components/Sidebar'
import { useEdu } from '../../components/EduContext'

const sectors = [
  'IT och digital', 'Teknik och industri', 'Marknad och reklam',
  'Handel och e-handel', 'Vård och omsorg', 'Konsult och rådgivning',
  'Media och kommunikation', 'Utbildning', 'Annat',
]

export default function NatverkPage() {
  const [profile, setProfile]   = useState<any>(null)
  const [partners, setPartners] = useState<any[]>([])
  const [perioder, setPerioder] = useState<any[]>([])
  const [antalPer, setAntalPer] = useState<Record<string, number>>({})
  const [utskick, setUtskick]   = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')
  const [klart, setKlart]       = useState('')
  const [busy, setBusy]         = useState(false)
  const [sok, setSok]           = useState('')

  const [vy, setVy] = useState<'lista' | 'nytt' | 'utskick'>('lista')

  const [namn, setNamn]       = useState('')
  const [ort, setOrt]         = useState('')
  const [bransch, setBransch] = useState('')
  const [kontakt, setKontakt] = useState('')
  const [epost, setEpost]     = useState('')
  const [tel, setTel]         = useState('')
  const [note, setNote]       = useState('')

  const [uPeriod, setUPeriod] = useState('')
  const [uAmne, setUAmne]     = useState('')
  const [uText, setUText]     = useState('')

  const [valdaOrter, setValdaOrter] = useState<string[]>([])
  const [urvalda, setUrvalda]       = useState<string[]>([])

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

    const { data } = await supabase
      .from('education_partners')
      .select('*, companies(*)')
      .eq('education_id', current.id)
      .order('created_at', { ascending: false })
    setPartners(data || [])

    const { data: cls } = await supabase
      .from('classes').select('id, name').eq('education_id', current.id)
    const classIds = (cls || []).map(c => c.id)

    if (classIds.length) {
      const { data: per } = await supabase
        .from('lia_periods')
        .select('id, name, start_date, end_date, classes(name)')
        .in('class_id', classIds).order('sequence')
      setPerioder(per || [])

      const periodIds = (per || []).map(p => p.id)
      if (periodIds.length) {
        const { data: pl } = await supabase
          .from('placements').select('company_id').in('lia_period_id', periodIds)
          .not('company_id', 'is', null)
        const map: Record<string, number> = {}
        for (const p of pl || []) {
          if (p.company_id) map[p.company_id] = (map[p.company_id] || 0) + 1
        }
        setAntalPer(map)
      }
    }

    const { data: u } = await supabase
      .from('natverk_utskick').select('*').eq('education_id', current.id)
      .order('skickat_at', { ascending: false }).limit(5)
    setUtskick(u || [])

    setLoading(false)
  }

  async function sparaForetag(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setError('')

    const { data: co, error: coErr } = await supabase
      .from('companies')
      .insert({
        company_name: namn.trim(), city: ort.trim(),
        sector: bransch || null,
        contact_name: kontakt.trim() || null,
        contact_email: epost.trim() || null,
        contact_phone: tel.trim() || null,
        spots_total: 1, spots_available: 1,
        origin: 'ul', claimed: false,
      })
      .select('id').single()

    if (coErr) { setError(coErr.message); setBusy(false); return }

    await supabase.from('education_partners').insert({
      education_id: current.id, company_id: co.id, note: note.trim() || null,
    })

    setNamn(''); setOrt(''); setBransch(''); setKontakt('')
    setEpost(''); setTel(''); setNote('')
    setVy('lista'); setBusy(false)
    load()
  }

  async function bjudIn(companyId: string) {
    setBusy(true); setError(''); setKlart('')
    const res = await fetch('/api/bjud-in', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId, educationId: current.id }),
    })
    const data = await res.json()
    setBusy(false)
    if (!res.ok) { setError(data.error || 'Inbjudan kunde inte skickas'); return }
    setKlart('Inbjudan skickad till ' + data.email)
  }

  async function skickaUtskick(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setError(''); setKlart('')

    const res = await fetch('/api/natverk-utskick', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        educationId: current.id,
        periodId: uPeriod || null,
        amne: uAmne, meddelande: uText,
        companyIds: mottagare.map(p => p.companies?.id).filter(Boolean),
      }),
    })
    const data = await res.json()
    setBusy(false)

    if (!res.ok) { setError(data.error || 'Utskicket misslyckades'); return }

    setKlart(`Skickat till ${data.skickade} av ${data.totalt} foretag`)
    setUAmne(''); setUText(''); setUPeriod('')
    setValdaOrter([]); setUrvalda([])
    setVy('lista')
    load()
  }

  async function vaxlaUtskick(id: string, nuvarande: boolean) {
    await supabase.from('education_partners').update({ utskick: !nuvarande }).eq('id', id)
    load()
  }

  async function taBort(id: string) {
    if (!confirm('Ta bort företaget från ditt nätverk?')) return
    await supabase.from('education_partners').delete().eq('id', id)
    load()
  }

  function skrivTill(c: any) {
    if (!c?.user_id) {
      setError('Företaget har inget konto än. Bjud in dem först.')
      return
    }
    router.push('/dashboard/messages?to=' + c.user_id +
      '&name=' + encodeURIComponent(c.company_name || '') +
      '&om=' + encodeURIComponent('handledare, ' + (c.company_name || '')))
  }

  const synliga = partners.filter(p => {
    if (!sok.trim()) return true
    const q = sok.toLowerCase()
    const c = p.companies
    return (c?.company_name || '').toLowerCase().includes(q)
        || (c?.city || '').toLowerCase().includes(q)
        || (c?.sector || '').toLowerCase().includes(q)
        || (c?.contact_name || '').toLowerCase().includes(q)
  })

  function laddaNer() {
    const rader = [
      ['Företag', 'Ort', 'Bransch', 'Kontaktperson', 'E-post', 'Telefon', 'Konto', 'Placeringar', 'Anteckning'],
      ...synliga.map(p => {
        const c = p.companies
        return [
          c?.company_name || '', c?.city || '', c?.sector || '',
          c?.contact_name || '', c?.contact_email || '', c?.contact_phone || '',
          c?.claimed ? 'Ja' : 'Nej',
          String(antalPer[c?.id] || 0),
          p.note || '',
        ]
      }),
    ]
    const csv = rader.map(r => r.map(f => '"' + String(f).replace(/"/g, '""') + '"').join(';')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url
    a.download = 'Foretagsnatverk-' + (current?.program_name || '').replace(/[^a-zA-ZåäöÅÄÖ0-9]/g, '-') + '.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const medKonto   = partners.filter(p => p.companies?.claimed).length
  const medStudent = partners.filter(p => antalPer[p.companies?.id]).length
  const totStudent = Object.values(antalPer).reduce((a, b) => a + b, 0)

  const orter = Array.from(new Set(
    partners.map(p => p.companies?.city).filter(Boolean)
  )).sort() as string[]

  const mottagare = partners.filter(p => {
    if (!p.utskick) return false
    if (urvalda.includes(p.id)) return false
    if (valdaOrter.length && !valdaOrter.includes(p.companies?.city)) return false
    return true
  })

  function vaxlaOrt(o: string) {
    setValdaOrter(valdaOrter.includes(o)
      ? valdaOrter.filter(x => x !== o)
      : [...valdaOrter, o])
  }

  function vaxlaMottagare(id: string) {
    setUrvalda(urvalda.includes(id)
      ? urvalda.filter(x => x !== id)
      : [...urvalda, id])
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

      <main className="flex-1 p-5 sm:p-8 max-w-4xl">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-1">
          <h1 className="text-2xl sm:text-3xl">Företagsnätverk</h1>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => { setVy(vy === 'utskick' ? 'lista' : 'utskick'); setError(''); setKlart('') }}
              className="border border-line rounded-full px-4 py-2.5 text-sm text-muted hover:border-text/30 transition"
            >
              Skicka utskick
            </button>
            <button
              onClick={laddaNer}
              disabled={!partners.length}
              className="border border-line rounded-full px-4 py-2.5 text-sm text-muted hover:border-text/30 transition disabled:opacity-40"
            >
              Ladda ner lista
            </button>
            <button
              onClick={() => { setVy(vy === 'nytt' ? 'lista' : 'nytt'); setError(''); setKlart('') }}
              className="bg-accent text-white px-5 py-2.5 rounded-full text-sm font-medium hover:opacity-85 transition"
            >
              {vy === 'nytt' ? 'Avbryt' : 'Lägg till företag'}
            </button>
          </div>
        </div>
        <p className="text-muted text-sm mb-6">
          {current?.program_name}. Företag du har relation med, oavsett om de har konto.
        </p>

        {error && (
          <p className="bg-alert/10 border border-alert/25 text-alert text-sm rounded-lg px-4 py-3 mb-5">{error}</p>
        )}
        {klart && (
          <p className="bg-ok/10 border border-ok/25 text-ok text-sm rounded-lg px-4 py-3 mb-5">{klart}</p>
        )}

        {partners.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {[
              { n: partners.length, label: 'företag i nätverket' },
              { n: medKonto,        label: 'har konto' },
              { n: medStudent,      label: 'har tagit emot' },
              { n: totStudent,      label: 'placeringar totalt' },
            ].map((s, i) => (
              <div key={i} className="bg-card border border-line rounded-xl p-5">
                <p className="font-display text-3xl font-extrabold">{s.n}</p>
                <p className="text-muted text-sm mt-1 leading-snug">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {vy === 'utskick' && (
          <form onSubmit={skickaUtskick} className="bg-card border border-line rounded-xl p-6 mb-6 space-y-4">
            <div>
              <h2 className="text-base">Utskick till nätverket</h2>
              <p className="text-muted text-sm mt-0.5">
                Går till {mottagare.length} av {partners.filter(p => p.utskick).length} företag.
                Svar kommer till din e-post.
              </p>
            </div>

            {orter.length > 1 && (
              <div>
                <label className="block text-sm mb-2">Filtrera på ort</label>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setValdaOrter([])}
                    className={`px-3.5 py-2 rounded-full text-sm transition ${
                      !valdaOrter.length ? 'bg-text text-paper' : 'bg-paper border border-line text-muted hover:border-text/30'
                    }`}
                  >
                    Alla orter
                  </button>
                  {orter.map(o => (
                    <button
                      key={o}
                      type="button"
                      onClick={() => vaxlaOrt(o)}
                      className={`px-3.5 py-2 rounded-full text-sm transition ${
                        valdaOrter.includes(o) ? 'bg-text text-paper' : 'bg-paper border border-line text-muted hover:border-text/30'
                      }`}
                    >
                      {o}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm mb-2">Mottagare</label>
              <div className="border border-line rounded-lg divide-y divide-line max-h-60 overflow-y-auto">
                {partners.filter(p => p.utskick).length === 0 ? (
                  <p className="text-muted text-sm p-4">Inga företag tar emot utskick.</p>
                ) : partners.filter(p => p.utskick).map(p => {
                  const c = p.companies
                  if (valdaOrter.length && !valdaOrter.includes(c?.city)) return null
                  const med = !urvalda.includes(p.id)
                  return (
                    <label key={p.id} className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-paper/60">
                      <input
                        type="checkbox"
                        checked={med}
                        onChange={() => vaxlaMottagare(p.id)}
                        className="w-4 h-4 accent-[#e8420a] shrink-0"
                      />
                      <span className="min-w-0">
                        <span className="text-sm">{c?.company_name}</span>
                        <span className="text-muted text-sm">
                          {c?.city ? ', ' + c.city : ''}
                          {!c?.contact_email && !c?.claimed ? ' — saknar e-post' : ''}
                        </span>
                      </span>
                    </label>
                  )
                })}
              </div>
            </div>

            <div>
              <label className="block text-sm mb-1.5">Koppla till LIA-period</label>
              <select value={uPeriod} onChange={e => setUPeriod(e.target.value)} className={field}>
                <option value="">Ingen särskild period</option>
                {perioder.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name}, {(p as any).classes?.name}: {p.start_date} till {p.end_date}
                  </option>
                ))}
              </select>
              <p className="text-muted text-xs mt-1.5">Perioden visas som en faktaruta i mejlet.</p>
            </div>

            <div>
              <label className="block text-sm mb-1.5">Ämne</label>
              <input value={uAmne} onChange={e => setUAmne(e.target.value)} required
                placeholder="Dags att planera LIA för våren" className={field} />
            </div>

            <div>
              <label className="block text-sm mb-1.5">Meddelande</label>
              <textarea value={uText} onChange={e => setUText(e.target.value)} required rows={7}
                placeholder="Skriv som du skulle skrivit i ett vanligt mejl."
                className={field + ' resize-y'} />
            </div>

            <div className="flex gap-2">
              <button type="submit" disabled={busy || !mottagare.length} className="bg-text text-paper rounded-full px-6 py-2.5 text-sm font-medium hover:opacity-85 transition disabled:opacity-40">
                {busy ? 'Skickar' : 'Skicka till ' + mottagare.length}
              </button>
              <button type="button" onClick={() => setVy('lista')} className="text-muted text-sm px-4">
                Avbryt
              </button>
            </div>
          </form>
        )}

        {vy === 'nytt' && (
          <form onSubmit={sparaForetag} className="bg-card border border-line rounded-xl p-6 mb-6 space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm mb-1.5">Företagsnamn</label>
                <input value={namn} onChange={e => setNamn(e.target.value)} required placeholder="Automations AB" className={field} />
              </div>
              <div>
                <label className="block text-sm mb-1.5">Ort</label>
                <input value={ort} onChange={e => setOrt(e.target.value)} required placeholder="Malmö" className={field} />
              </div>
            </div>
            <div>
              <label className="block text-sm mb-1.5">Bransch</label>
              <select value={bransch} onChange={e => setBransch(e.target.value)} className={field}>
                <option value="">Välj bransch</option>
                {sectors.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="grid sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm mb-1.5">Kontaktperson</label>
                <input value={kontakt} onChange={e => setKontakt(e.target.value)} className={field} />
              </div>
              <div>
                <label className="block text-sm mb-1.5">E-post</label>
                <input type="email" value={epost} onChange={e => setEpost(e.target.value)} className={field} />
              </div>
              <div>
                <label className="block text-sm mb-1.5">Telefon</label>
                <input value={tel} onChange={e => setTel(e.target.value)} className={field} />
              </div>
            </div>
            <div>
              <label className="block text-sm mb-1.5">Anteckning</label>
              <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
                placeholder="Tar gärna emot inom automation, hör av sig i god tid"
                className={field + ' resize-y'} />
            </div>
            <button type="submit" disabled={busy} className="bg-text text-paper rounded-full px-6 py-2.5 text-sm font-medium hover:opacity-85 transition disabled:opacity-40">
              {busy ? 'Sparar' : 'Lägg till'}
            </button>
          </form>
        )}

        {partners.length > 3 && (
          <input
            value={sok}
            onChange={e => setSok(e.target.value)}
            placeholder="Sök företag, ort eller kontaktperson"
            className="bg-card border border-line rounded-lg px-4 py-2.5 text-sm w-full sm:w-80 outline-none focus:border-text/40 transition mb-5"
          />
        )}

        {synliga.length === 0 ? (
          <div className="bg-card border border-line rounded-xl p-12 text-center">
            <p className="mb-1">{partners.length === 0 ? 'Nätverket är tomt' : 'Inga träffar'}</p>
            <p className="text-muted text-sm">
              {partners.length === 0
                ? 'Lägg in företagen du samarbetar med, så har du dem samlade inför nästa LIA-period.'
                : 'Prova en annan sökning.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {synliga.map(p => {
              const c = p.companies
              const antal = antalPer[c?.id] || 0
              return (
                <article key={p.id} className="bg-card border border-line rounded-xl p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-base">{c?.company_name}</h2>
                        {!c?.claimed && (
                          <span className="bg-warn/10 text-warn rounded-full px-2.5 py-0.5 text-xs">
                            inget konto
                          </span>
                        )}
                        {antal > 0 && (
                          <span className="bg-ok/10 text-ok rounded-full px-2.5 py-0.5 text-xs">
                            {antal} {antal === 1 ? 'placering' : 'placeringar'}
                          </span>
                        )}
                      </div>
                      <p className="text-muted text-sm mt-0.5">
                        {c?.sector ? c.sector + ', ' : ''}{c?.city}
                      </p>
                      {(c?.contact_name || c?.contact_email) && (
                        <p className="text-muted text-sm mt-1">
                          {c.contact_name}
                          {c.contact_email ? ', ' + c.contact_email : ''}
                          {c.contact_phone ? ', ' + c.contact_phone : ''}
                        </p>
                      )}
                      {p.note && <p className="text-sm mt-2 leading-relaxed">{p.note}</p>}
                      {!p.utskick && (
                        <p className="text-muted text-xs mt-2">Får inte utskick</p>
                      )}
                    </div>

                    <div className="flex flex-col items-end gap-2 shrink-0">
                      {c?.claimed && (
                        <button onClick={() => skrivTill(c)} className="bg-text text-paper rounded-full px-4 py-1.5 text-sm font-medium hover:opacity-85 transition">
                          Skriv
                        </button>
                      )}
                      {!c?.claimed && c?.contact_email && (
                        <button onClick={() => bjudIn(c.id)} disabled={busy} className="bg-text text-paper rounded-full px-4 py-1.5 text-sm font-medium hover:opacity-85 transition disabled:opacity-40">
                          Bjud in
                        </button>
                      )}
                      <button onClick={() => vaxlaUtskick(p.id, p.utskick)} className="text-muted hover:text-text text-sm transition">
                        {p.utskick ? 'Pausa utskick' : 'Tillåt utskick'}
                      </button>
                      <button onClick={() => taBort(p.id)} className="text-muted hover:text-alert text-sm transition">
                        Ta bort
                      </button>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}

        {utskick.length > 0 && (
          <section className="mt-8">
            <h2 className="text-base mb-1">Senaste utskicken</h2>
            <p className="text-muted text-sm mb-4">De fem senaste.</p>
            <div className="bg-card border border-line rounded-xl divide-y divide-line">
              {utskick.map(u => (
                <div key={u.id} className="px-5 py-4 flex flex-wrap items-baseline justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm">{u.amne}</p>
                    <p className="text-muted text-xs mt-0.5">
                      {new Date(u.skickat_at).toLocaleDateString('sv-SE')}
                    </p>
                  </div>
                  <span className="text-muted text-sm shrink-0">
                    {u.antal} mottagare
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
