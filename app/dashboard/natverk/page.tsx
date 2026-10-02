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

const ERBJUDER = [
  { v: 'lia',        t: 'LIA-plats' },
  { v: 'forelasning',t: 'Gästföreläsning' },
  { v: 'studiebesok',t: 'Studiebesök' },
  { v: 'ledning',    t: 'Ledningsgrupp' },
  { v: 'avsikt',     t: 'Avsiktsförklaring' },
]

const statusEtikett: Record<string, string> = {
  ja: 'svarat ja', aktiv: 'aktiv', svalnande: 'svalnande', ny: 'ny', nej: 'tackat nej',
}
const statusStil: Record<string, string> = {
  ja: 'bg-ok/10 text-ok', aktiv: 'bg-ok/10 text-ok',
  svalnande: 'bg-warn/10 text-warn', ny: 'bg-muted/10 text-muted', nej: 'bg-muted/10 text-muted',
}
const ordning: Record<string, number> = { ja: 0, svalnande: 1, aktiv: 2, ny: 3, nej: 4 }

export default function NatverkPage() {
  const [profile, setProfile]     = useState<any>(null)
  const [partners, setPartners]   = useState<any[]>([])
  const [kopplingar, setKopplingar] = useState<Record<string, any[]>>({})
  const [skolEdus, setSkolEdus]   = useState<any[]>([])
  const [perioder, setPerioder]   = useState<any[]>([])
  const [historik, setHistorik]   = useState<Record<string, any[]>>({})
  const [kontakter, setKontakter] = useState<Record<string, any[]>>({})
  const [logg, setLogg]           = useState<Record<string, any[]>>({})
  const [utskick, setUtskick]     = useState<any[]>([])
  const [forfragningar, setForfragningar] = useState<any[]>([])
  const [senasteSvar, setSenasteSvar]     = useState<Record<string, string>>({})
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState('')
  const [klart, setKlart]         = useState('')
  const [busy, setBusy]           = useState(false)
  const [sok, setSok]             = useState('')
  const [visaArkiv, setVisaArkiv] = useState(false)
  const [oppen, setOppen]         = useState('')
  const [statusFilter, setStatusFilter] = useState('alla')
  const [vilka, setVilka]         = useState<'min' | 'alla'>('min')
  const [sidor, setSidor]         = useState(1)
  const [visaAlla, setVisaAlla]   = useState('')

  const [vy, setVy] = useState<'lista' | 'nytt' | 'utskick' | 'intresse'>('lista')

  const [namn, setNamn]       = useState('')
  const [ort, setOrt]         = useState('')
  const [bransch, setBransch] = useState('')
  const [note, setNote]       = useState('')
  const [nyaEdus, setNyaEdus] = useState<Record<string, string[]>>({})

  const [uPeriod, setUPeriod] = useState('')
  const [uAmne, setUAmne]     = useState('')
  const [uText, setUText]     = useState('')
  const [iPeriod, setIPeriod] = useState('')
  const [valdaOrter, setValdaOrter] = useState<string[]>([])
  const [urvalda, setUrvalda]       = useState<string[]>([])

  const [kFor, setKFor]     = useState('')
  const [kNamn, setKNamn]   = useState('')
  const [kRoll, setKRoll]   = useState('')
  const [kEpost, setKEpost] = useState('')
  const [kTel, setKTel]     = useState('')

  const [lTyp, setLTyp]     = useState('samtal')
  const [lDatum, setLDatum] = useState('')
  const [lText, setLText]   = useState('')

  const supabase = createClient()
  const router   = useRouter()
  const { current, loading: eduLoading } = useEdu()

  useEffect(() => {
    if (eduLoading) return
    if (!current) { setLoading(false); return }
    load()
  }, [current?.id, eduLoading])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: prof } = await supabase
      .from('profiles').select('*').eq('id', user.id).single()
    setProfile(prof)

    const skolId = current.school_id
    if (!skolId) { setLoading(false); return }

    // Alla utbildningar på skolan
    const { data: edus } = await supabase
      .from('educations').select('id, program_name')
      .eq('school_id', skolId).eq('active', true).order('program_name')
    setSkolEdus(edus || [])

    // Skolans företagsnätverk
    const { data } = await supabase
      .from('education_partners')
      .select('*, companies(*)')
      .eq('school_id', skolId)
      .order('created_at', { ascending: false })
    setPartners(data || [])

    const partnerIds = (data || []).map(p => p.id)

    if (partnerIds.length) {
      const { data: pe } = await supabase
        .from('partner_educations').select('*').in('partner_id', partnerIds)
      const pm: Record<string, any[]> = {}
      for (const k of pe || []) {
        pm[k.partner_id] = pm[k.partner_id] || []
        pm[k.partner_id].push(k)
      }
      setKopplingar(pm)

      const { data: kont } = await supabase
        .from('partner_contacts').select('*').in('partner_id', partnerIds).order('created_at')
      const km: Record<string, any[]> = {}
      for (const k of kont || []) {
        km[k.partner_id] = km[k.partner_id] || []
        km[k.partner_id].push(k)
      }
      setKontakter(km)

      const { data: lg } = await supabase
        .from('partner_log').select('*, profiles:created_by(full_name)')
        .in('partner_id', partnerIds).order('datum', { ascending: false })
      const lm: Record<string, any[]> = {}
      for (const l of lg || []) {
        lm[l.partner_id] = lm[l.partner_id] || []
        lm[l.partner_id].push(l)
      }
      setLogg(lm)
    }

    const { data: cls } = await supabase
      .from('classes').select('id, name').eq('education_id', current.id)
    const classIds = (cls || []).map(c => c.id)

    if (classIds.length) {
      const { data: per } = await supabase
        .from('lia_periods').select('id, name, start_date, end_date, classes(name)')
        .in('class_id', classIds).order('sequence')
      setPerioder(per || [])

      const periodIds = (per || []).map(p => p.id)
      if (periodIds.length) {
        const { data: pl } = await supabase
          .from('placements')
          .select('company_id, status, lia_periods(name, start_date, end_date, classes(name)), students(profiles(full_name))')
          .in('lia_period_id', periodIds).not('company_id', 'is', null)

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

    const { data: ff } = await supabase
      .from('intresseforfragan')
      .select('*, lia_periods(name, start_date, end_date), intressesvar(partner_id, svar, antal, kommentar, kontakt_namn, svarat_at, education_partners(companies(company_name, city)))')
      .eq('education_id', current.id)
      .order('skapad_at', { ascending: false }).limit(3)
    setForfragningar(ff || [])

    const senaste = (ff || [])[0]
    if (senaste) {
      const sm: Record<string, string> = {}
      for (const s of (senaste as any).intressesvar || []) {
        if (s.svar) sm[s.partner_id] = s.svar
      }
      setSenasteSvar(sm)
    }

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

    const { data: partner, error: pErr } = await supabase
      .from('education_partners').insert({
        school_id:    current.school_id,
        education_id: current.id,
        company_id:   co.id,
        note:         note.trim() || null,
        kalla:        'manuell',
      })
      .select('id').single()

    if (pErr) { setError(pErr.message); setBusy(false); return }

    for (const [eduId, erbjuder] of Object.entries(nyaEdus)) {
      if (!erbjuder.length) continue
      await supabase.from('partner_educations').insert({
        partner_id: partner.id, education_id: eduId, erbjuder,
      })
    }

    setNamn(''); setOrt(''); setBransch(''); setNote(''); setNyaEdus({})
    setVy('lista'); setBusy(false)
    load()
  }

  async function vaxlaErbjuder(partnerId: string, eduId: string, varde: string) {
    const kopp = (kopplingar[partnerId] || []).find(k => k.education_id === eduId)

    if (!kopp) {
      await supabase.from('partner_educations').insert({
        partner_id: partnerId, education_id: eduId, erbjuder: [varde],
      })
    } else {
      const har = (kopp.erbjuder || []).includes(varde)
      const nytt = har
        ? (kopp.erbjuder || []).filter((x: string) => x !== varde)
        : [...(kopp.erbjuder || []), varde]

      if (!nytt.length) {
        await supabase.from('partner_educations').delete().eq('id', kopp.id)
      } else {
        await supabase.from('partner_educations').update({ erbjuder: nytt }).eq('id', kopp.id)
      }
    }
    load()
  }

  function nyttErbjuder(eduId: string, varde: string) {
    const nu = nyaEdus[eduId] || []
    const nytt = nu.includes(varde) ? nu.filter(x => x !== varde) : [...nu, varde]
    setNyaEdus({ ...nyaEdus, [eduId]: nytt })
  }

  async function sparaKontakt(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setError('')
    const { error: err } = await supabase.from('partner_contacts').insert({
      partner_id: kFor, name: kNamn.trim(), role: kRoll.trim() || null,
      email: kEpost.trim() || null, phone: kTel.trim() || null,
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

  async function sparaLogg(partnerId: string) {
    if (!lText.trim()) return
    setBusy(true); setError('')
    const { error: err } = await supabase.from('partner_log').insert({
      partner_id: partnerId, typ: lTyp,
      datum: lDatum || new Date().toISOString().slice(0, 10),
      text: lText.trim(), created_by: profile?.id,
    })
    setBusy(false)
    if (err) { setError(err.message); return }
    setLText(''); setLDatum(''); setLTyp('samtal')
    load()
  }

  async function taBortLogg(id: string) {
    await supabase.from('partner_log').delete().eq('id', id)
    load()
  }

  function loggTypText(t: string) {
    const m: Record<string, string> = {
      samtal: 'Samtal', mote: 'Möte', mejl: 'Mejl', besok: 'Besök', anteckning: 'Anteckning',
    }
    return m[t] || t
  }

  async function sparaNote(id: string, text: string) {
    await supabase.from('education_partners').update({ note: text.trim() || null }).eq('id', id)
    load()
  }

  async function bjudIn(companyId: string) {
    setBusy(true); setError(''); setKlart('')
    const res = await fetch('/api/bjud-in', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
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
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        educationId: current.id, periodId: uPeriod || null,
        amne: uAmne, meddelande: uText,
        companyIds: mottagare.map(p => p.companies?.id).filter(Boolean),
      }),
    })
    const data = await res.json()
    setBusy(false)
    if (!res.ok) { setError(data.error || 'Utskicket misslyckades'); return }
    if (data.varning) setError(data.varning)
    setKlart('Skickat till ' + data.skickade + ' av ' + data.totalt + ' mottagare')
    setUAmne(''); setUText(''); setUPeriod(''); setValdaOrter([]); setUrvalda([])
    setVy('lista'); load()
  }

  async function skickaIntresse() {
    if (!mottagare.length) return
    setBusy(true); setError(''); setKlart('')
    const res = await fetch('/api/intresseforfragan', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        educationId: current.id, periodId: iPeriod || null,
        partnerIds: mottagare.map(p => p.id),
      }),
    })
    const data = await res.json()
    setBusy(false)
    if (!res.ok) { setError(data.error || 'Förfrågan kunde inte skickas'); return }
    setKlart('Förfrågan skickad till ' + data.skickade + ' kontaktpersoner')
    setIPeriod(''); setValdaOrter([]); setUrvalda([])
    setVy('lista'); load()
  }

  async function vaxlaUtskick(id: string, nuvarande: boolean) {
    await supabase.from('education_partners').update({ utskick: !nuvarande }).eq('id', id)
    load()
  }

  async function vaxlaAktiv(p: any) {
    const antal = (historik[p.companies?.id] || []).length
    if (p.aktiv && antal > 0) {
      if (!confirm('Arkivera ' + p.companies?.company_name + '? Historiken finns kvar.')) return
    }
    await supabase.from('education_partners').update({ aktiv: !p.aktiv, utskick: false }).eq('id', p.id)
    load()
  }

  async function taBort(p: any) {
    if ((historik[p.companies?.id] || []).length > 0) {
      setError('Företaget har tagit emot studerande. Arkivera i stället.')
      return
    }
    if (!confirm('Ta bort företaget ur nätverket?')) return
    await supabase.from('education_partners').delete().eq('id', p.id)
    load()
  }

  function skrivTill(c: any) {
    if (!c?.user_id) { setError('Företaget har inget konto än. Bjud in dem först.'); return }
    router.push('/dashboard/messages?to=' + c.user_id +
      '&name=' + encodeURIComponent(c.company_name || '') +
      '&om=' + encodeURIComponent('handledare, ' + (c.company_name || '')))
  }

  function relationsstatus(p: any): string {
    const svar = senasteSvar[p.id]
    if (svar === 'ja')  return 'ja'
    if (svar === 'nej') return 'nej'
    const hist = historik[p.companies?.id] || []
    if (!hist.length) return 'ny'
    const senast = hist.map((h: any) => h.lia_periods?.end_date).filter(Boolean).sort().pop()
    if (!senast) return 'aktiv'
    const manader = (Date.now() - new Date(senast).getTime()) / (1000 * 60 * 60 * 24 * 30)
    return manader > 12 ? 'svalnande' : 'aktiv'
  }

  function forMinUtbildning(p: any) {
    return (kopplingar[p.id] || []).some(k => k.education_id === current?.id)
  }

  function erbjuderFor(p: any, eduId: string): string[] {
    const k = (kopplingar[p.id] || []).find(x => x.education_id === eduId)
    return k?.erbjuder || []
  }

  const aktiva = partners.filter(p => p.aktiv !== false)
  const arkiv  = partners.filter(p => p.aktiv === false)

  const synliga = (visaArkiv ? arkiv : aktiva)
    .filter(p => {
      if (vilka === 'min' && !forMinUtbildning(p)) return false
      if (statusFilter !== 'alla' && relationsstatus(p) !== statusFilter) return false
      if (!sok.trim()) return true
      const q = sok.toLowerCase()
      const c = p.companies
      const kont = (kontakter[p.id] || []).map(k => k.name).join(' ').toLowerCase()
      return (c?.company_name || '').toLowerCase().includes(q)
          || (c?.city || '').toLowerCase().includes(q)
          || (c?.sector || '').toLowerCase().includes(q)
          || kont.includes(q)
    })
    .sort((a, b) => ordning[relationsstatus(a)] - ordning[relationsstatus(b)])

  const visade = synliga.slice(0, sidor * 20)

  const minaForetag = aktiva.filter(p => forMinUtbildning(p))
  const medKonto    = minaForetag.filter(p => p.companies?.claimed).length
  const medStudent  = minaForetag.filter(p => (historik[p.companies?.id] || []).length).length
  const totStudent  = Object.values(historik).reduce((a, b) => a + b.length, 0)

  const orter = Array.from(new Set(
    minaForetag.map(p => p.companies?.city).filter(Boolean)
  )).sort() as string[]

  const mottagare = minaForetag.filter(p => {
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

  function laddaNer() {
    const rader = [
      ['Företag', 'Ort', 'Bransch', 'Kontaktpersoner', 'Erbjuder', 'Konto', 'Placeringar', 'Anteckning'],
      ...synliga.map(p => {
        const c = p.companies
        const kont = (kontakter[p.id] || []).filter(k => k.aktiv)
          .map(k => k.name + (k.email ? ' <' + k.email + '>' : '')).join(' | ')
        const erb = erbjuderFor(p, current?.id)
          .map(v => ERBJUDER.find(e => e.v === v)?.t || v).join(', ')
        return [
          c?.company_name || '', c?.city || '', c?.sector || '', kont, erb,
          c?.claimed ? 'Ja' : 'Nej',
          String((historik[c?.id] || []).length),
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

  const field = 'w-full bg-paper border border-line rounded-lg px-4 py-2.5 text-sm outline-none focus:border-text/40 transition'

  if (loading) return (
    <div className="min-h-screen bg-paper flex items-center justify-center">
      <p className="text-muted text-sm">Laddar</p>
    </div>
  )

  if (!eduLoading && !current) return (
    <div className="min-h-screen bg-paper flex items-center justify-center p-4">
      <div className="bg-card border border-line rounded-xl p-8 max-w-md text-center text-text">
        <p className="mb-1">Ingen utbildning vald</p>
        <p className="text-muted text-sm mb-5">Lägg upp din utbildning så kommer du igång.</p>
        <a href="/dashboard/utbildningar" className="inline-block bg-text text-paper rounded-full px-6 py-2.5 text-sm font-medium">
          Mina utbildningar
        </a>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-paper text-text flex flex-col lg:flex-row">
      <Sidebar role="education" name={profile?.full_name} subtitle={current?.program_name} />

      <main className="flex-1 p-5 sm:p-8 max-w-4xl">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-1">
          <h1 className="text-2xl sm:text-3xl">Företagsnätverk</h1>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => { setVy(vy === 'intresse' ? 'lista' : 'intresse'); setError(''); setKlart('') }}
              className="border border-line rounded-full px-4 py-2.5 text-sm text-muted hover:border-text/30 transition">
              Fråga om intresse
            </button>
            <button onClick={() => { setVy(vy === 'utskick' ? 'lista' : 'utskick'); setError(''); setKlart('') }}
              className="border border-line rounded-full px-4 py-2.5 text-sm text-muted hover:border-text/30 transition">
              Skicka utskick
            </button>
            <button onClick={laddaNer} disabled={!partners.length}
              className="border border-line rounded-full px-4 py-2.5 text-sm text-muted hover:border-text/30 transition disabled:opacity-40">
              Ladda ner
            </button>
            <button onClick={() => { setVy(vy === 'nytt' ? 'lista' : 'nytt'); setError(''); setKlart('') }}
              className="bg-accent text-white px-5 py-2.5 rounded-full text-sm font-medium hover:opacity-85 transition">
              {vy === 'nytt' ? 'Avbryt' : 'Lägg till företag'}
            </button>
          </div>
        </div>
        <p className="text-muted text-sm mb-6">
          Nätverket delas av alla utbildningar på skolan. Du ser dem som är markerade
          för {current?.program_name}.
        </p>

        {error && <p className="bg-alert/10 border border-alert/25 text-alert text-sm rounded-lg px-4 py-3 mb-5">{error}</p>}
        {klart && <p className="bg-ok/10 border border-ok/25 text-ok text-sm rounded-lg px-4 py-3 mb-5">{klart}</p>}

        {partners.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {[
              { n: minaForetag.length, label: 'för din utbildning' },
              { n: aktiva.length,      label: 'på skolan totalt' },
              { n: medStudent,         label: 'har tagit emot' },
              { n: totStudent,         label: 'placeringar' },
            ].map((s, i) => (
              <div key={i} className="bg-card border border-line rounded-xl p-5">
                <p className="font-display text-3xl font-extrabold">{s.n}</p>
                <p className="text-muted text-sm mt-1 leading-snug">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {vy === 'intresse' && (
          <div className="bg-card border border-line rounded-xl p-6 mb-6 space-y-4">
            <div>
              <h2 className="text-base">Fråga om intresse inför LIA-period</h2>
              <p className="text-muted text-sm mt-0.5">
                Går till {mottagare.length} företag markerade för din utbildning.
              </p>
            </div>
            <div>
              <label className="block text-sm mb-1.5">Vilken period gäller det?</label>
              <select value={iPeriod} onChange={e => setIPeriod(e.target.value)} className={field}>
                <option value="">Ingen särskild period</option>
                {perioder.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name}, {(p as any).classes?.name}: {p.start_date} till {p.end_date}
                  </option>
                ))}
              </select>
            </div>
            {orter.length > 1 && (
              <div>
                <label className="block text-sm mb-2">Filtrera på ort</label>
                <div className="flex flex-wrap gap-1.5">
                  <button type="button" onClick={() => setValdaOrter([])}
                    className={'px-3.5 py-2 rounded-full text-sm transition ' + (!valdaOrter.length ? 'bg-text text-paper' : 'bg-paper border border-line text-muted hover:border-text/30')}>
                    Alla orter
                  </button>
                  {orter.map(o => (
                    <button key={o} type="button" onClick={() => vaxlaOrt(o)}
                      className={'px-3.5 py-2 rounded-full text-sm transition ' + (valdaOrter.includes(o) ? 'bg-text text-paper' : 'bg-paper border border-line text-muted hover:border-text/30')}>
                      {o}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={skickaIntresse} disabled={busy || !mottagare.length}
                className="bg-text text-paper rounded-full px-6 py-2.5 text-sm font-medium hover:opacity-85 transition disabled:opacity-40">
                {busy ? 'Skickar' : 'Skicka förfrågan'}
              </button>
              <button onClick={() => setVy('lista')} className="text-muted text-sm px-4">Avbryt</button>
            </div>
          </div>
        )}

        {vy === 'utskick' && (
          <form onSubmit={skickaUtskick} className="bg-card border border-line rounded-xl p-6 mb-6 space-y-4">
            <div>
              <h2 className="text-base">Utskick till nätverket</h2>
              <p className="text-muted text-sm mt-0.5">
                Går till {mottagare.length} företag. Svar kommer till din e-post.
              </p>
            </div>
            {orter.length > 1 && (
              <div>
                <label className="block text-sm mb-2">Filtrera på ort</label>
                <div className="flex flex-wrap gap-1.5">
                  <button type="button" onClick={() => setValdaOrter([])}
                    className={'px-3.5 py-2 rounded-full text-sm transition ' + (!valdaOrter.length ? 'bg-text text-paper' : 'bg-paper border border-line text-muted hover:border-text/30')}>
                    Alla orter
                  </button>
                  {orter.map(o => (
                    <button key={o} type="button" onClick={() => vaxlaOrt(o)}
                      className={'px-3.5 py-2 rounded-full text-sm transition ' + (valdaOrter.includes(o) ? 'bg-text text-paper' : 'bg-paper border border-line text-muted hover:border-text/30')}>
                      {o}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div>
              <label className="block text-sm mb-2">Mottagare</label>
              <div className="border border-line rounded-lg divide-y divide-line max-h-60 overflow-y-auto">
                {minaForetag.filter(p => p.utskick).length === 0 ? (
                  <p className="text-muted text-sm p-4">Inga företag tar emot utskick.</p>
                ) : minaForetag.filter(p => p.utskick).map(p => {
                  const c = p.companies
                  if (valdaOrter.length && !valdaOrter.includes(c?.city)) return null
                  return (
                    <label key={p.id} className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-paper/60">
                      <input type="checkbox" checked={!urvalda.includes(p.id)}
                        onChange={() => vaxlaMottagare(p.id)}
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
              Företaget läggs till i skolans nätverk. Markera vilka utbildningar det gäller
              och vad de kan erbjuda.
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

            <div className="border-t border-line pt-4">
              <label className="block text-sm mb-1">Relevant för vilka utbildningar</label>
              <p className="text-muted text-xs mb-3">
                Kryssa i vad företaget kan erbjuda per utbildning. Lämna tomt för de som inte passar.
              </p>
              <div className="space-y-3">
                {skolEdus.map(e => (
                  <div key={e.id} className="border border-line rounded-lg p-3.5">
                    <p className="text-sm font-medium mb-2">{e.program_name}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {ERBJUDER.map(o => {
                        const pa = (nyaEdus[e.id] || []).includes(o.v)
                        return (
                          <button key={o.v} type="button" onClick={() => nyttErbjuder(e.id, o.v)}
                            className={'px-3 py-1.5 rounded-full text-xs transition ' +
                              (pa ? 'bg-accent text-white' : 'bg-paper border border-line text-muted hover:border-text/30')}>
                            {o.t}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm mb-1.5">Anteckning</label>
              <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
                placeholder="Vad är bra att veta om företaget?" className={field + ' resize-y'} />
            </div>
            <button type="submit" disabled={busy}
              className="bg-text text-paper rounded-full px-6 py-2.5 text-sm font-medium hover:opacity-85 transition disabled:opacity-40">
              {busy ? 'Sparar' : 'Lägg till'}
            </button>
          </form>
        )}

        <div className="flex flex-wrap items-center gap-3 mb-4">
          <input value={sok} onChange={e => { setSok(e.target.value); setSidor(1) }}
            placeholder="Sök företag, ort eller kontaktperson"
            className="bg-card border border-line rounded-lg px-4 py-2.5 text-sm w-full sm:w-72 outline-none focus:border-text/40 transition" />

          <div className="flex gap-1.5">
            <button onClick={() => { setVilka('min'); setSidor(1) }}
              className={'px-4 py-2.5 rounded-full text-sm transition ' + (vilka === 'min' ? 'bg-text text-paper' : 'border border-line text-muted hover:border-text/30')}>
              Min utbildning
            </button>
            <button onClick={() => { setVilka('alla'); setSidor(1) }}
              className={'px-4 py-2.5 rounded-full text-sm transition ' + (vilka === 'alla' ? 'bg-text text-paper' : 'border border-line text-muted hover:border-text/30')}>
              Hela skolan
            </button>
          </div>

          {arkiv.length > 0 && (
            <button onClick={() => { setVisaArkiv(!visaArkiv); setSidor(1) }}
              className={'px-4 py-2.5 rounded-full text-sm transition ' + (visaArkiv ? 'bg-text text-paper' : 'border border-line text-muted hover:border-text/30')}>
              {visaArkiv ? 'Visa aktiva' : 'Arkiv (' + arkiv.length + ')'}
            </button>
          )}
        </div>

        {!visaArkiv && partners.length > 5 && (
          <div className="flex flex-wrap gap-1.5 mb-5">
            {[
              { v: 'alla', t: 'Alla' }, { v: 'ja', t: 'Svarat ja' },
              { v: 'svalnande', t: 'Svalnande' }, { v: 'aktiv', t: 'Aktiva' },
              { v: 'ny', t: 'Nya' }, { v: 'nej', t: 'Tackat nej' },
            ].map(f => {
              const bas = vilka === 'min' ? minaForetag : aktiva
              const n = f.v === 'alla' ? bas.length : bas.filter(p => relationsstatus(p) === f.v).length
              if (f.v !== 'alla' && n === 0) return null
              return (
                <button key={f.v} onClick={() => { setStatusFilter(f.v); setSidor(1) }}
                  className={'px-3.5 py-2 rounded-full text-sm transition ' +
                    (statusFilter === f.v ? 'bg-text text-paper' : 'bg-card border border-line text-muted hover:border-text/30')}>
                  {f.t} <span className="opacity-50">{n}</span>
                </button>
              )
            })}
          </div>
        )}

        {synliga.length === 0 ? (
          <div className="bg-card border border-line rounded-xl p-12 text-center">
            <p className="mb-1">
              {visaArkiv ? 'Arkivet är tomt' : partners.length === 0 ? 'Nätverket är tomt' : 'Inga träffar'}
            </p>
            <p className="text-muted text-sm">
              {partners.length === 0
                ? 'Företag läggs till automatiskt när en studerande placeras hos dem.'
                : vilka === 'min'
                ? 'Prova Hela skolan, eller ett annat filter.'
                : 'Prova en annan sökning.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {visade.map(p => {
              const c = p.companies
              const hist = historik[c?.id] || []
              const kont = kontakter[p.id] || []
              const aktivaKont = kont.filter(k => k.aktiv)
              const rstatus = relationsstatus(p)
              const minErb = erbjuderFor(p, current?.id)
              const andraEdus = (kopplingar[p.id] || []).filter(k => k.education_id !== current?.id)

              return (
                <article key={p.id} className="bg-card border border-line rounded-xl overflow-hidden">
                  <div className="p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h2 className="text-base">{c?.company_name}</h2>
                          {!visaArkiv && (
                            <span className={'rounded-full px-2.5 py-0.5 text-xs ' + statusStil[rstatus]}>
                              {statusEtikett[rstatus]}
                            </span>
                          )}
                          {!c?.claimed && (
                            <span className="bg-warn/10 text-warn rounded-full px-2.5 py-0.5 text-xs">inget konto</span>
                          )}
                          {hist.length > 0 && (
                            <span className="bg-muted/10 text-muted rounded-full px-2.5 py-0.5 text-xs">
                              {hist.length} {hist.length === 1 ? 'placering' : 'placeringar'}
                            </span>
                          )}
                        </div>
                        <p className="text-muted text-sm mt-0.5">
                          {c?.sector ? c.sector + ', ' : ''}{c?.city}
                        </p>

                        {minErb.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {minErb.map(v => (
                              <span key={v} className="bg-accent/8 text-accent border border-accent/20 rounded-full px-2.5 py-0.5 text-xs">
                                {ERBJUDER.find(e => e.v === v)?.t || v}
                              </span>
                            ))}
                          </div>
                        )}

                        {vilka === 'alla' && !minErb.length && andraEdus.length > 0 && (
                          <p className="text-muted text-xs mt-2">
                            Markerad för {andraEdus.length} {andraEdus.length === 1 ? 'annan utbildning' : 'andra utbildningar'}
                          </p>
                        )}

                        {aktivaKont.length > 0 && (
                          <div className="mt-2 space-y-0.5">
                            {aktivaKont.map(k => (
                              <p key={k.id} className="text-muted text-sm">
                                {k.name}{k.role ? ', ' + k.role : ''}
                                {k.email ? ', ' + k.email : ''}{k.phone ? ', ' + k.phone : ''}
                              </p>
                            ))}
                          </div>
                        )}

                        {p.note && <p className="text-sm mt-2 leading-relaxed">{p.note}</p>}

                        {(() => {
                          const senaste = (logg[p.id] || [])[0]
                          if (!senaste) return null
                          const d = Math.floor((Date.now() - new Date(senaste.datum).getTime()) / 86400000)
                          return (
                            <p className="text-muted text-sm mt-2">
                              {loggTypText(senaste.typ)} {senaste.datum}
                              {senaste.profiles?.full_name ? ', ' + senaste.profiles.full_name : ''}
                              {d > 180 ? ' · ' + Math.floor(d / 30) + ' månader sedan' : ''}
                            </p>
                          )
                        })()}
                      </div>

                      <div className="flex flex-col items-end gap-2 shrink-0">
                        {c?.claimed && p.aktiv !== false && (
                          <button onClick={() => skrivTill(c)}
                            className="bg-text text-paper rounded-full px-4 py-1.5 text-sm font-medium hover:opacity-85 transition">
                            Skriv
                          </button>
                        )}
                        {!c?.claimed && p.aktiv !== false && aktivaKont.some(k => k.email) && (
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
                        <p className="text-sm font-medium mb-1">Utbildningar och erbjudanden</p>
                        <p className="text-muted text-xs mb-3">
                          Kryssa i vad företaget kan erbjuda. Alla utbildningsledare på skolan ser detta.
                        </p>
                        <div className="space-y-3">
                          {skolEdus.filter(e => e.id === current?.id || erbjuderFor(p, e.id).length > 0 || visaAlla === p.id).map(e => {
                            const erb = erbjuderFor(p, e.id)
                            return (
                              <div key={e.id} className={'border rounded-lg p-3.5 bg-card ' +
                                (e.id === current?.id ? 'border-accent/30' : 'border-line')}>
                                <p className="text-sm font-medium mb-2">
                                  {e.program_name}
                                  {e.id === current?.id && (
                                    <span className="text-muted text-xs font-normal"> — din utbildning</span>
                                  )}
                                </p>
                                <div className="flex flex-wrap gap-1.5">
                                  {ERBJUDER.map(o => {
                                    const pa = erb.includes(o.v)
                                    return (
                                      <button key={o.v} onClick={() => vaxlaErbjuder(p.id, e.id, o.v)}
                                        className={'px-3 py-1.5 rounded-full text-xs transition ' +
                                          (pa ? 'bg-accent text-white' : 'bg-paper border border-line text-muted hover:border-text/30')}>
                                        {o.t}
                                      </button>
                                    )
                                  })}

                                  {(() => {
                                    const dolda = skolEdus.filter(x => x.id !== current?.id && erbjuderFor(p, x.id).length === 0).length
                                    if (!dolda) return null
                                    return (
                                      <button onClick={() => setVisaAlla(visaAlla === p.id ? '' : p.id)}
                                        className="text-sm text-muted hover:text-text transition">
                                        {visaAlla === p.id ? 'Dölj utbildningar utan markering' : 'Visa ' + dolda + ' ' + (dolda === 1 ? 'utbildning till' : 'utbildningar till')}
                                      </button>
                                    )
                                  })()}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>

                      <div>
                        <p className="text-sm font-medium mb-2">Kontaktpersoner</p>
                        {kont.length === 0 ? (
                          <p className="text-muted text-sm mb-3">Inga kontaktpersoner inlagda.</p>
                        ) : (
                          <div className="border border-line rounded-lg divide-y divide-line bg-card mb-3">
                            {kont.map(k => (
                              <div key={k.id} className="px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                                <div className="min-w-0">
                                  <p className={'text-sm ' + (k.aktiv ? '' : 'text-muted line-through')}>
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
                                    className="text-muted hover:text-alert text-sm transition">Ta bort</button>
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
                        <p className="text-sm font-medium mb-2">Om företaget</p>
                        <textarea defaultValue={p.note || ''} onBlur={e => sparaNote(p.id, e.target.value)}
                          rows={2} placeholder="Vad är bra att veta? Inriktning, förutsättningar, annat bestående."
                          className={field + ' resize-y bg-card'} />
                        <p className="text-muted text-xs mt-1.5">Sparas när du klickar utanför rutan.</p>
                      </div>

                      <div>
                        <p className="text-sm font-medium mb-2">Kontakthistorik</p>
                        {(logg[p.id] || []).length === 0 ? (
                          <p className="text-muted text-sm mb-3">Inget loggat än.</p>
                        ) : (
                          <div className="border border-line rounded-lg divide-y divide-line bg-card mb-3 max-h-64 overflow-y-auto">
                            {(logg[p.id] || []).map(l => (
                              <div key={l.id} className="px-4 py-3 group">
                                <div className="flex flex-wrap items-baseline justify-between gap-2 mb-0.5">
                                  <span className="text-sm font-medium">{loggTypText(l.typ)}</span>
                                  <div className="flex items-center gap-3 shrink-0">
                                    <span className="text-muted text-xs">
                                      {l.profiles?.full_name ? l.profiles.full_name + ' · ' : ''}{l.datum}
                                    </span>
                                    <button onClick={() => taBortLogg(l.id)}
                                      className="text-muted hover:text-alert text-xs opacity-0 group-hover:opacity-100 transition">
                                      Ta bort
                                    </button>
                                  </div>
                                </div>
                                <p className="text-sm leading-relaxed">{l.text}</p>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="bg-card border border-line rounded-lg p-4 space-y-3">
                          <div className="grid sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-sm mb-1.5">Typ</label>
                              <select value={lTyp} onChange={e => setLTyp(e.target.value)} className={field}>
                                <option value="samtal">Samtal</option>
                                <option value="mejl">Mejl</option>
                                <option value="mote">Möte</option>
                                <option value="besok">Besök</option>
                                <option value="anteckning">Anteckning</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-sm mb-1.5">Datum</label>
                              <input type="date" value={lDatum} onChange={e => setLDatum(e.target.value)} className={field} />
                              <p className="text-muted text-xs mt-1.5">Tomt blir idag.</p>
                            </div>
                          </div>
                          <div>
                            <label className="block text-sm mb-1.5">Vad hände?</label>
                            <textarea value={lText} onChange={e => setLText(e.target.value)} rows={2}
                              placeholder="Pratade med Anna, de tar två till våren men vill veta datum i god tid."
                              className={field + ' resize-y'} />
                          </div>
                          <button onClick={() => sparaLogg(p.id)} disabled={busy || !lText.trim()}
                            className="bg-text text-paper rounded-full px-5 py-2 text-sm font-medium hover:opacity-85 transition disabled:opacity-40">
                            {busy ? 'Sparar' : 'Spara i loggen'}
                          </button>
                        </div>
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
                        {p.aktiv !== false && (
                          <button onClick={() => vaxlaUtskick(p.id, p.utskick)}
                            className="text-muted hover:text-text text-sm transition">
                            {p.utskick ? 'Pausa utskick' : 'Tillåt utskick'}
                          </button>
                        )}
                        <button onClick={() => vaxlaAktiv(p)} className="text-muted hover:text-text text-sm transition">
                          {p.aktiv !== false ? 'Arkivera' : 'Återaktivera'}
                        </button>
                        {hist.length === 0 && (
                          <button onClick={() => taBort(p)} className="text-muted hover:text-alert text-sm transition">
                            Ta bort helt
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </article>
              )
            })}

            {synliga.length > visade.length && (
              <button onClick={() => setSidor(sidor + 1)}
                className="w-full border border-line rounded-xl py-3 text-sm text-muted hover:border-text/30 transition">
                Visa fler ({synliga.length - visade.length} kvar)
              </button>
            )}
          </div>
        )}

        {forfragningar.length > 0 && !visaArkiv && (
          <section className="mt-8">
            <h2 className="text-base mb-1">Intresseförfrågningar</h2>
            <p className="text-muted text-sm mb-4">De senaste tre.</p>
            <div className="space-y-3">
              {forfragningar.map(f => {
                const svar     = f.intressesvar || []
                const ja       = svar.filter((s: any) => s.svar === 'ja')
                const kanske   = svar.filter((s: any) => s.svar === 'kanske')
                const nej      = svar.filter((s: any) => s.svar === 'nej')
                const platser  = ja.reduce((a: number, s: any) => a + (s.antal || 0), 0)
                const osvarade = svar.filter((s: any) => !s.svarat_at).length

                return (
                  <article key={f.id} className="bg-card border border-line rounded-xl p-5">
                    <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
                      <p className="text-sm font-medium">
                        {f.lia_periods?.name || 'Ingen period'}
                        {f.lia_periods?.start_date ? ', ' + f.lia_periods.start_date : ''}
                      </p>
                      <p className="text-muted text-sm">
                        skickad {new Date(f.skapad_at).toLocaleDateString('sv-SE')}
                      </p>
                    </div>
                    <div className="grid grid-cols-4 gap-3 mb-4">
                      {[
                        { n: ja.length, t: 'ja', c: 'text-ok' },
                        { n: kanske.length, t: 'kanske', c: 'text-warn' },
                        { n: nej.length, t: 'nej', c: 'text-muted' },
                        { n: platser, t: 'platser', c: 'text-text' },
                      ].map((s, i) => (
                        <div key={i}>
                          <p className={'font-display text-2xl font-extrabold ' + s.c}>{s.n}</p>
                          <p className="text-muted text-xs">{s.t}</p>
                        </div>
                      ))}
                    </div>
                    {svar.filter((s: any) => s.svarat_at).length > 0 && (
                      <div className="border-t border-line pt-3 space-y-2">
                        {svar.filter((s: any) => s.svarat_at).map((s: any, i: number) => (
                          <div key={i}>
                            <div className="flex flex-wrap items-baseline justify-between gap-2">
                              <span className="text-sm">
                                {s.education_partners?.companies?.company_name}
                                {s.kontakt_namn ? ', ' + s.kontakt_namn : ''}
                              </span>
                              <span className={'text-sm ' + (s.svar === 'ja' ? 'text-ok' : s.svar === 'kanske' ? 'text-warn' : 'text-muted')}>
                                {s.svar}{s.antal ? ', ' + s.antal + ' platser' : ''}
                              </span>
                            </div>
                            {s.kommentar && <p className="text-muted text-sm mt-0.5">{s.kommentar}</p>}
                          </div>
                        ))}
                      </div>
                    )}
                    {osvarade > 0 && (
                      <p className="text-muted text-sm mt-3">{osvarade} har inte svarat än.</p>
                    )}
                  </article>
                )
              })}
            </div>
          </section>
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
