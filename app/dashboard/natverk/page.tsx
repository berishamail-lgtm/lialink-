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
  const [historik, setHistorik] = useState<Record<string, any[]>>({})
  const [kontakter, setKontakter] = useState<Record<string, any[]>>({})
  const [utskick, setUtskick]   = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')
  const [klart, setKlart]       = useState('')
  const [busy, setBusy]         = useState(false)
  const [sok, setSok]           = useState('')
  const [visaArkiv, setVisaArkiv] = useState(false)
  const [oppen, setOppen]       = useState('')

  const [vy, setVy] = useState<'lista' | 'nytt' | 'utskick'>('lista')

  const [namn, setNamn]       = useState('')
  const [ort, setOrt]         = useState('')
  const [bransch, setBransch] = useState('')
  const [note, setNote]       = useState('')

  const [uPeriod, setUPeriod] = useState('')
  const [uAmne, setUAmne]     = useState('')
  const [uText, setUText]     = useState('')
  const [valdaOrter, setValdaOrter] = useState<string[]>([])
  const [urvalda, setUrvalda]       = useState<string[]>([])

  // Ny kontaktperson
  const [kFor, setKFor]       = useState('')
  const [kNamn, setKNamn]     = useState('')
  const [kRoll, setKRoll]     = useState('')
  const [kEpost, setKEpost]   = useState('')
  const [kTel, setKTel]       = useState('')

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

    const partnerIds = (data || []).map(p => p.id)
    if (partnerIds.length) {
      const { data: kont } = await supabase
        .from('partner_contacts').select('*').in('partner_id', partnerIds)
        .order('created_at')
      const km: Record<string, any[]> = {}
      for (const k of kont || []) {
        km[k.partner_id] = km[k.partner_id] || []
        km[k.partner_id].push(k)
      }
      setKontakter(km)
    }

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
          .from('placements')
          .select('company_id, status, lia_periods(name, start_date, end_date, classes(name)), students(profiles(full_name))')
          .in('lia_period_id', periodIds)
          .not('company_id', 'is', null)

        const hm: Record<string, any[]> = {}
        for (const p of pl || []) {
          if (!p.company_id) continue
          hm[p.company_id] = hm[p.company_id] || []
          hm[p.company_id].push(p)
        }
        setHistorik(hm)
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
        spots_total: 1, spots_available: 1,
        origin: 'ul', claimed: false,
      })
      .select('id').single()

    if (coErr) { setError(coErr.message); setBusy(false); return }

    await supabase.from('education_partners').insert({
      education_id: current.id, company_id: co.id,
      note: note.trim() || null, kalla: 'manuell',
    })

    setNamn(''); setOrt(''); setBransch(''); setNote('')
    setVy('lista'); setBusy(false)
    load()
  }

  async function sparaKontakt(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setError('')

    const { error: err } = await supabase.from('partner_contacts').insert({
      partner_id: kFor,
      name:  kNamn.trim(),
      role:  kRoll.trim() || null,
      email: kEpost.trim() || null,
      phone: kTel.trim() || null,
    })

    setBusy(false)
    if (err) { setError(err.message); return }

    setKNamn(''); setKRoll(''); setKEpost(''); setKTel(''); setKFor('')
    load()
  }

  async function vaxlaKontakt(id: string, aktiv: boolean) {
    await supabase.from('partner_contacts').update({ aktiv: !aktiv }).eq('id', id)
    load()
  }

  async function taBortKontakt(id: string) {
    if (!confirm('Ta bort kontaktpersonen?')) return
    await supabase.from('partner_contacts').delete().eq('id', id)
    load()
  }

  async function sparaNote(id: string, text: string) {
    await supabase.from('education_partners').update({ note: text.trim() || null }).eq('id', id)
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

    setKlart('Skickat till ' + data.skickade + ' av ' + data.totalt + ' företag')
    setUAmne(''); setUText(''); setUPeriod('')
    setValdaOrter([]); setUrvalda([])
    setVy('lista')
    load()
  }

  async function vaxlaUtskick(id: string, nuvarande: boolean) {
    await supabase.from('education_partners').update({ utskick: !nuvarande }).eq('id', id)
    load()
  }

  async function vaxlaAktiv(p: any) {
    const antal = (historik[p.companies?.id] || []).length
    if (p.aktiv && antal > 0) {
      if (!confirm('Arkivera ' + p.companies?.company_name + '? De försvinner ur listan men historiken finns kvar.')) return
    }
    await supabase.from('education_partners').update({ aktiv: !p.aktiv, utskick: false }).eq('id', p.id)
    load()
  }

  async function taBort(p: any) {
    const antal = (historik[p.companies?.id] || []).length
    if (antal > 0) {
      setError('Företaget har tagit emot studenter. Arkivera i stället, så bevaras historiken.')
      return
    }
    if (!confirm('Ta bort företaget ur nätverket?')) return
    await supabase.from('education_partners').delete().eq('id', p.id)
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

  const aktiva  = partners.filter(p => p.aktiv)
  const arkiv   = partners.filter(p => !p.aktiv)

  const synliga = (visaArkiv ? arkiv : aktiva).filter(p => {
    if (!sok.trim()) return true
    const q = sok.toLowerCase()
    const c = p.companies
    const kont = (kontakter[p.id] || []).map(k => k.name).join(' ').toLowerCase()
    return (c?.company_name || '').toLowerCase().includes(q)
        || (c?.city || '').toLowerCase().includes(q)
        || (c?.sector || '').toLowerCase().includes(q)
        || kont.includes(q)
  })

  function laddaNer() {
    const rader = [
      ['Företag', 'Ort', 'Bransch', 'Kontaktpersoner', 'Konto', 'Placeringar', 'Status', 'Anteckning'],
      ...partners.map(p => {
        const c = p.companies
        const kont = (kontakter[p.id] || []).filter(k => k.aktiv)
          .map(k => k.name + (k.email ? ' <' + k.email + '>' : '')).join(' | ')
        return [
          c?.company_name || '', c?.city || '', c?.sector || '',
          kont,
          c?.claimed ? 'Ja' : 'Nej',
          String((historik[c?.id] || []).length),
          p.aktiv ? 'Aktiv' : 'Arkiverad',
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

  const medKonto   = aktiva.filter(p => p.companies?.claimed).length
  const medStudent = aktiva.filter(p => (historik[p.companies?.id] || []).length).length
  const totStudent = Object.values(historik).reduce((a, b) => a + b.length, 0)

  const orter = Array.from(new Set(
    aktiva.map(p => p.companies?.city).filter(Boolean)
  )).sort() as string[]

  const mottagare = aktiva.filter(p => {
    if (!p.utskick) return false
    if (urvalda.includes(p.id)) return false
    if (valdaOrter.length && !valdaOrter.includes(p.companies?.city)) return false
    return true
  })

  function vaxlaOrt(o: string) {
    setValdaOrter(valdaOrter.includes(o) ? valdaOrter.filter(x => x !== o) : [...valdaOrter, o])
  }

  function vaxlaMottagare(id: string) {
    setUrvalda(urvalda.includes(id) ? urvalda.filter(x => x !== id) : [...urvalda, id])
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
          Företag som tagit emot studenter läggs till automatiskt. Relationen blir kvar
          även efter avslutad LIA-period.
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
              { n: aktiva.length, label: 'företag i nätverket' },
              { n: medKonto,      label: 'har konto' },
              { n: medStudent,    label: 'har tagit emot' },
              { n: totStudent,    label: 'placeringar totalt' },
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
                Går till {mottagare.length} av {aktiva.filter(p => p.utskick).length} företag.
                Svar kommer till din e-post.
              </p>
            </div>

            {orter.length > 1 && (
              <div>
                <label className="block text-sm mb-2">Filtrera på ort</label>
                <div className="flex flex-wrap gap-1.5">
                  <button type="button" onClick={() => setValdaOrter([])}
                    className={`px-3.5 py-2 rounded-full text-sm transition ${
                      !valdaOrter.length ? 'bg-text text-paper' : 'bg-paper border border-line text-muted hover:border-text/30'
                    }`}>
                    Alla orter
                  </button>
                  {orter.map(o => (
                    <button key={o} type="button" onClick={() => vaxlaOrt(o)}
                      className={`px-3.5 py-2 rounded-full text-sm transition ${
                        valdaOrter.includes(o) ? 'bg-text text-paper' : 'bg-paper border border-line text-muted hover:border-text/30'
                      }`}>
                      {o}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm mb-2">Mottagare</label>
              <div className="border border-line rounded-lg divide-y divide-line max-h-60 overflow-y-auto">
                {aktiva.filter(p => p.utskick).length === 0 ? (
                  <p className="text-muted text-sm p-4">Inga företag tar emot utskick.</p>
                ) : aktiva.filter(p => p.utskick).map(p => {
                  const c = p.companies
                  if (valdaOrter.length && !valdaOrter.includes(c?.city)) return null
                  const med = !urvalda.includes(p.id)
                  return (
                    <label key={p.id} className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-paper/60">
                      <input type="checkbox" checked={med} onChange={() => vaxlaMottagare(p.id)}
                        className="w-4 h-4 accent-[#e8420a] shrink-0" />
                      <span className="min-w-0">
                        <span className="text-sm">{c?.company_name}</span>
                        <span className="text-muted text-sm">{c?.city ? ', ' + c.city : ''}</span>
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
              <button type="submit" disabled={busy || !mottagare.length}
                className="bg-text text-paper rounded-full px-6 py-2.5 text-sm font-medium hover:opacity-85 transition disabled:opacity-40">
                {busy ? 'Skickar' : 'Skicka till ' + mottagare.length}
              </button>
              <button type="button" onClick={() => setVy('lista')} className="text-muted text-sm px-4">Avbryt</button>
            </div>
          </form>
        )}

        {vy === 'nytt' && (
          <form onSubmit={sparaForetag} className="bg-card border border-line rounded-xl p-6 mb-6 space-y-4">
            <p className="text-muted text-sm">
              Kontaktpersoner lägger du till på företagskortet efteråt.
            </p>
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
            <div>
              <label className="block text-sm mb-1.5">Anteckning</label>
              <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
                placeholder="Tar gärna emot inom automation, hör av sig i god tid"
                className={field + ' resize-y'} />
            </div>
            <button type="submit" disabled={busy}
              className="bg-text text-paper rounded-full px-6 py-2.5 text-sm font-medium hover:opacity-85 transition disabled:opacity-40">
              {busy ? 'Sparar' : 'Lägg till'}
            </button>
          </form>
        )}

        <div className="flex flex-wrap items-center gap-3 mb-5">
          <input
            value={sok}
            onChange={e => setSok(e.target.value)}
            placeholder="Sök företag, ort eller kontaktperson"
            className="bg-card border border-line rounded-lg px-4 py-2.5 text-sm w-full sm:w-72 outline-none focus:border-text/40 transition"
          />
          {arkiv.length > 0 && (
            <button
              onClick={() => setVisaArkiv(!visaArkiv)}
              className={`px-4 py-2.5 rounded-full text-sm transition ${
                visaArkiv ? 'bg-text text-paper' : 'border border-line text-muted hover:border-text/30'
              }`}
            >
              {visaArkiv ? 'Visa aktiva' : 'Arkiv (' + arkiv.length + ')'}
            </button>
          )}
        </div>

        {synliga.length === 0 ? (
          <div className="bg-card border border-line rounded-xl p-12 text-center">
            <p className="mb-1">{visaArkiv ? 'Arkivet är tomt' : partners.length === 0 ? 'Nätverket är tomt' : 'Inga träffar'}</p>
            <p className="text-muted text-sm">
              {partners.length === 0
                ? 'Företag läggs till automatiskt när en student placeras hos dem.'
                : 'Prova en annan sökning.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {synliga.map(p => {
              const c = p.companies
              const hist = historik[c?.id] || []
              const kont = kontakter[p.id] || []
              const aktivaKont = kont.filter(k => k.aktiv)

              return (
                <article key={p.id} className="bg-card border border-line rounded-xl overflow-hidden">
                  <div className="p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h2 className="text-base">{c?.company_name}</h2>
                          {!c?.claimed && (
                            <span className="bg-warn/10 text-warn rounded-full px-2.5 py-0.5 text-xs">inget konto</span>
                          )}
                          {hist.length > 0 && (
                            <span className="bg-ok/10 text-ok rounded-full px-2.5 py-0.5 text-xs">
                              {hist.length} {hist.length === 1 ? 'placering' : 'placeringar'}
                            </span>
                          )}
                          {p.kalla === 'placering' && (
                            <span className="bg-muted/10 text-muted rounded-full px-2.5 py-0.5 text-xs">via placering</span>
                          )}
                        </div>
                        <p className="text-muted text-sm mt-0.5">
                          {c?.sector ? c.sector + ', ' : ''}{c?.city}
                        </p>

                        {aktivaKont.length > 0 && (
                          <div className="mt-2 space-y-0.5">
                            {aktivaKont.map(k => (
                              <p key={k.id} className="text-muted text-sm">
                                {k.name}
                                {k.role ? ', ' + k.role : ''}
                                {k.email ? ', ' + k.email : ''}
                                {k.phone ? ', ' + k.phone : ''}
                              </p>
                            ))}
                          </div>
                        )}

                        {p.note && <p className="text-sm mt-2 leading-relaxed">{p.note}</p>}
                        {!p.utskick && p.aktiv && (
                          <p className="text-muted text-xs mt-2">Får inte utskick</p>
                        )}
                      </div>

                      <div className="flex flex-col items-end gap-2 shrink-0">
                        {c?.claimed && p.aktiv && (
                          <button onClick={() => skrivTill(c)}
                            className="bg-text text-paper rounded-full px-4 py-1.5 text-sm font-medium hover:opacity-85 transition">
                            Skriv
                          </button>
                        )}
                        {!c?.claimed && p.aktiv && aktivaKont.some(k => k.email) && (
                          <button onClick={() => bjudIn(c.id)} disabled={busy}
                            className="bg-text text-paper rounded-full px-4 py-1.5 text-sm font-medium hover:opacity-85 transition disabled:opacity-40">
                            Bjud in
                          </button>
                        )}
                        <button onClick={() => setOppen(oppen === p.id ? '' : p.id)}
                          className="text-muted hover:text-text text-sm transition">
                          {oppen === p.id ? 'Dölj' : 'Hantera'}
                        </button>
                      </div>
                    </div>
                  </div>

                  {oppen === p.id && (
                    <div className="border-t border-line bg-paper/50 p-5 space-y-5">

                      <div>
                        <p className="text-sm font-medium mb-2">Kontaktpersoner</p>
                        {kont.length === 0 ? (
                          <p className="text-muted text-sm mb-3">Inga kontaktpersoner inlagda.</p>
                        ) : (
                          <div className="border border-line rounded-lg divide-y divide-line bg-card mb-3">
                            {kont.map(k => (
                              <div key={k.id} className="px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                                <div className="min-w-0">
                                  <p className={`text-sm ${k.aktiv ? '' : 'text-muted line-through'}`}>
                                    {k.name}{k.role ? ', ' + k.role : ''}
                                  </p>
                                  <p className="text-muted text-xs">
                                    {[k.email, k.phone].filter(Boolean).join(', ') || 'Inga uppgifter'}
                                  </p>
                                </div>
                                <div className="flex items-center gap-3 shrink-0">
                                  <button onClick={() => vaxlaKontakt(k.id, k.aktiv)}
                                    className="text-muted hover:text-text text-sm transition">
                                    {k.aktiv ? 'Slutat' : 'Återaktivera'}
                                  </button>
                                  <button onClick={() => taBortKontakt(k.id)}
                                    className="text-muted hover:text-alert text-sm transition">
                                    Ta bort
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {kFor === p.id ? (
                          <form onSubmit={sparaKontakt} className="bg-card border border-line rounded-lg p-4 space-y-3">
                            <div className="grid sm:grid-cols-2 gap-3">
                              <div>
                                <label className="block text-sm mb-1.5">Namn</label>
                                <input value={kNamn} onChange={e => setKNamn(e.target.value)} required
                                  placeholder="Anna Andersson" className={field} />
                              </div>
                              <div>
                                <label className="block text-sm mb-1.5">Roll</label>
                                <input value={kRoll} onChange={e => setKRoll(e.target.value)}
                                  placeholder="Handledare, HR, platschef" className={field} />
                              </div>
                            </div>
                            <div className="grid sm:grid-cols-2 gap-3">
                              <div>
                                <label className="block text-sm mb-1.5">E-post</label>
                                <input type="email" value={kEpost} onChange={e => setKEpost(e.target.value)} className={field} />
                              </div>
                              <div>
                                <label className="block text-sm mb-1.5">Telefon</label>
                                <input value={kTel} onChange={e => setKTel(e.target.value)} className={field} />
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <button type="submit" disabled={busy}
                                className="bg-text text-paper rounded-full px-5 py-2 text-sm font-medium hover:opacity-85 transition disabled:opacity-40">
                                Spara
                              </button>
                              <button type="button" onClick={() => setKFor('')} className="text-muted text-sm px-3">Avbryt</button>
                            </div>
                          </form>
                        ) : (
                          <button onClick={() => { setKFor(p.id); setError('') }}
                            className="text-sm text-muted hover:text-text transition">
                            Lägg till kontaktperson
                          </button>
                        )}
                      </div>

                      <div>
                        <p className="text-sm font-medium mb-2">Anteckning</p>
                        <textarea
                          defaultValue={p.note || ''}
                          onBlur={e => sparaNote(p.id, e.target.value)}
                          rows={2}
                          placeholder="Vad är bra att veta inför nästa gång?"
                          className={field + ' resize-y bg-card'}
                        />
                        <p className="text-muted text-xs mt-1.5">Sparas när du klickar utanför rutan.</p>
                      </div>

                      {hist.length > 0 && (
                        <div>
                          <p className="text-sm font-medium mb-2">Har tagit emot</p>
                          <div className="border border-line rounded-lg divide-y divide-line bg-card">
                            {hist.map((h, i) => (
                              <div key={i} className="px-4 py-2.5 flex flex-wrap items-baseline justify-between gap-2">
                                <span className="text-sm">{h.students?.profiles?.full_name}</span>
                                <span className="text-muted text-sm">
                                  {h.lia_periods?.name}
                                  {h.lia_periods?.classes?.name ? ', ' + h.lia_periods.classes.name : ''}
                                  {', '}{h.lia_periods?.start_date}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex flex-wrap gap-4 pt-1">
                        {p.aktiv && (
                          <button onClick={() => vaxlaUtskick(p.id, p.utskick)}
                            className="text-muted hover:text-text text-sm transition">
                            {p.utskick ? 'Pausa utskick' : 'Tillåt utskick'}
                          </button>
                        )}
                        <button onClick={() => vaxlaAktiv(p)}
                          className="text-muted hover:text-text text-sm transition">
                          {p.aktiv ? 'Arkivera' : 'Återaktivera'}
                        </button>
                        {hist.length === 0 && (
                          <button onClick={() => taBort(p)}
                            className="text-muted hover:text-alert text-sm transition">
                            Ta bort helt
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        )}

        {utskick.length > 0 && !visaArkiv && (
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
                  <span className="text-muted text-sm shrink-0">{u.antal} mottagare</span>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
