'use client'
import { useEffect, useState } from 'react'
import { createClient } from '../../lib/supabase'
import { useRouter } from 'next/navigation'
import Sidebar from '../../components/Sidebar'
import { useEdu } from '../../components/EduContext'

const statusStyle: Record<string, string> = {
  'söker':      'bg-alert/10 text-alert',
  'förslag':    'bg-warn/10 text-warn',
  'matchad':    'bg-warn/10 text-warn',
  'avtal':      'bg-[#2563eb]/10 text-[#2563eb]',
  'aktiv':      'bg-ok/10 text-ok',
  'klar':       'bg-ok/10 text-ok',
  'uppskjuten': 'bg-muted/10 text-muted',
  'avbruten':   'bg-muted/10 text-muted',
}

export default function StudentsPage() {
  const [profile, setProfile]         = useState<any>(null)
  const [students, setStudents]       = useState<any[]>([])
  const [klasser, setKlasser]         = useState<any[]>([])
  const [perioder, setPerioder]       = useState<any[]>([])
  const [placeringar, setPlaceringar] = useState<any[]>([])
  const [foretag, setForetag]         = useState<any[]>([])
  const [search, setSearch]           = useState('')
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState('')
  const [klart, setKlart]             = useState('')

  // Lägg till student
  const [visaForm, setVisaForm] = useState(false)
  const [nyNamn, setNyNamn]     = useState('')
  const [nyEpost, setNyEpost]   = useState('')
  const [nyOrt, setNyOrt]       = useState('')
  const [nyKlass, setNyKlass]   = useState('')
  const [busy, setBusy]         = useState(false)

  // Placera
  const [placera, setPlacera]   = useState<any>(null)
  const [valtForetag, setValtForetag] = useState('')
  const [nyttNamn, setNyttNamn]   = useState('')
  const [nyttOrt, setNyttOrt]     = useState('')
  const [nyttKontakt, setNyttKontakt] = useState('')
  const [nyttEpost, setNyttEpost] = useState('')
  const [nyttTel, setNyttTel]     = useState('')
  const [placeringNote, setPlaceringNote] = useState('')

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
      .from('classes').select('id, name, termin').eq('education_id', current.id)
    setKlasser(cls || [])
    if (cls?.length && !nyKlass) setNyKlass(cls[0].id)

    const classIds = (cls || []).map(c => c.id)

    if (classIds.length) {
      const { data: studs } = await supabase
        .from('students')
        .select('*, classes(name, termin), profiles(full_name, email, city)')
        .in('class_id', classIds)
        .order('created_at', { ascending: false })
      setStudents(studs || [])

      const { data: per } = await supabase
        .from('lia_periods').select('*').in('class_id', classIds).order('sequence')
      setPerioder(per || [])

      const periodIds = (per || []).map(p => p.id)
      if (periodIds.length) {
        const { data: pl } = await supabase
          .from('placements')
          .select('id, student_id, lia_period_id, status, companies(company_name)')
          .in('lia_period_id', periodIds)
        setPlaceringar(pl || [])
      } else setPlaceringar([])
    } else {
      setStudents([]); setPerioder([]); setPlaceringar([])
    }

    const { data: co } = await supabase
      .from('companies').select('id, company_name, city').order('company_name')
    setForetag(co || [])

    setLoading(false)
  }

  async function laggTill(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setError(''); setKlart('')

    const res = await fetch('/api/lagg-till-student', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ namn: nyNamn, email: nyEpost, city: nyOrt, classId: nyKlass }),
    })
    const data = await res.json()
    setBusy(false)

    if (!res.ok) { setError(data.error || 'Kunde inte lägga till studenten'); return }

    setKlart(data.varning || `Inbjudan skickad till ${data.email}`)
    setNyNamn(''); setNyEpost(''); setNyOrt(''); setVisaForm(false)
    load()
  }

  function oppnaPlacera(student: any, period: any, placering: any) {
    setPlacera({ student, period, placering })
    setValtForetag('')
    setNyttNamn(''); setNyttOrt(''); setNyttKontakt(''); setNyttEpost(''); setNyttTel('')
    setPlaceringNote('')
    setError('')
  }

  async function sparaPlacering(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setError('')

    const res = await fetch('/api/placera', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        placementId: placera.placering.id,
        companyId:   valtForetag || null,
        nyttForetag: valtForetag ? null : {
          namn: nyttNamn, ort: nyttOrt, kontakt: nyttKontakt,
          epost: nyttEpost, telefon: nyttTel,
        },
        note: placeringNote,
      }),
    })
    const data = await res.json()
    setBusy(false)

    if (!res.ok) { setError(data.error || 'Kunde inte placera studenten'); return }

    setKlart(`${placera.student.profiles?.full_name} placerad`)
    setPlacera(null)
    load()
  }

  function weeksUntil(d: string | null) {
    if (!d) return null
    return Math.round((new Date(d).getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 7))
  }

  const visible = students.filter(s => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (s.profiles?.full_name || '').toLowerCase().includes(q)
        || (s.profiles?.email || '').toLowerCase().includes(q)
        || (s.classes?.name || '').toLowerCase().includes(q)
  })

  const field = 'w-full bg-paper border border-line rounded-lg px-4 py-2.5 text-sm outline-none focus:border-text/40 transition'

  if (loading) return (
    <div className="min-h-screen bg-paper flex items-center justify-center">
      <p className="text-muted text-sm">Laddar</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-paper text-text flex flex-col lg:flex-row">
      <Sidebar role="education" name={profile?.full_name} subtitle={current?.program_name} />

      <main className="flex-1 p-5 sm:p-8 max-w-5xl">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-1">
          <h1 className="text-2xl sm:text-3xl">Studenter</h1>
          <button
            onClick={() => { setVisaForm(!visaForm); setError(''); setKlart('') }}
            className="bg-accent text-white px-5 py-2.5 rounded-full text-sm font-medium hover:opacity-85 transition"
          >
            {visaForm ? 'Avbryt' : 'Lägg till student'}
          </button>
        </div>
        <p className="text-muted text-sm mb-6">
          {students.length} {students.length === 1 ? 'student' : 'studenter'} i {current?.program_name}
        </p>

        {error && (
          <p className="bg-alert/10 border border-alert/25 text-alert text-sm rounded-lg px-4 py-3 mb-5">{error}</p>
        )}
        {klart && (
          <p className="bg-ok/10 border border-ok/25 text-ok text-sm rounded-lg px-4 py-3 mb-5">{klart}</p>
        )}

        {visaForm && (
          <form onSubmit={laggTill} className="bg-card border border-line rounded-xl p-6 mb-6 space-y-4">
            <p className="text-muted text-sm">
              Studenten får ett mejl med en länk för att välja lösenord, och syns i
              listan direkt.
            </p>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm mb-1.5">Namn</label>
                <input value={nyNamn} onChange={e => setNyNamn(e.target.value)} required placeholder="Anna Svensson" className={field} />
              </div>
              <div>
                <label className="block text-sm mb-1.5">E-post</label>
                <input type="email" value={nyEpost} onChange={e => setNyEpost(e.target.value)} required placeholder="anna@mail.se" className={field} />
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm mb-1.5">Klass</label>
                <select value={nyKlass} onChange={e => setNyKlass(e.target.value)} required className={field}>
                  {klasser.map(k => (
                    <option key={k.id} value={k.id}>{k.name}{k.termin ? `, ${k.termin}` : ''}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm mb-1.5">Ort</label>
                <input value={nyOrt} onChange={e => setNyOrt(e.target.value)} placeholder="Malmö" className={field} />
              </div>
            </div>
            <button type="submit" disabled={busy || !klasser.length} className="bg-text text-paper rounded-full px-6 py-2.5 text-sm font-medium hover:opacity-85 transition disabled:opacity-40">
              {busy ? 'Lägger till' : 'Lägg till och skicka inbjudan'}
            </button>
            {!klasser.length && (
              <p className="text-muted text-sm">Lägg upp en klass under Planering först.</p>
            )}
          </form>
        )}

        {placera && (
          <form onSubmit={sparaPlacering} className="bg-card border border-accent/30 rounded-xl p-6 mb-6 space-y-4">
            <div>
              <h2 className="text-base">
                Placera {placera.student.profiles?.full_name}
              </h2>
              <p className="text-muted text-sm mt-0.5">
                {placera.period.name}, {placera.period.start_date} till {placera.period.end_date}
              </p>
            </div>

            <div>
              <label className="block text-sm mb-1.5">Välj företag</label>
              <select value={valtForetag} onChange={e => setValtForetag(e.target.value)} className={field}>
                <option value="">Nytt företag, fyll i nedan</option>
                {foretag.map(c => (
                  <option key={c.id} value={c.id}>{c.company_name}{c.city ? `, ${c.city}` : ''}</option>
                ))}
              </select>
            </div>

            {!valtForetag && (
              <div className="border-t border-line pt-4 space-y-4">
                <p className="text-sm">Nytt företag</p>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm mb-1.5">Företagsnamn</label>
                    <input value={nyttNamn} onChange={e => setNyttNamn(e.target.value)} required={!valtForetag} placeholder="Automations AB" className={field} />
                  </div>
                  <div>
                    <label className="block text-sm mb-1.5">Ort</label>
                    <input value={nyttOrt} onChange={e => setNyttOrt(e.target.value)} placeholder="Malmö" className={field} />
                  </div>
                </div>
                <div className="grid sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm mb-1.5">Kontaktperson</label>
                    <input value={nyttKontakt} onChange={e => setNyttKontakt(e.target.value)} className={field} />
                  </div>
                  <div>
                    <label className="block text-sm mb-1.5">E-post</label>
                    <input type="email" value={nyttEpost} onChange={e => setNyttEpost(e.target.value)} className={field} />
                  </div>
                  <div>
                    <label className="block text-sm mb-1.5">Telefon</label>
                    <input value={nyttTel} onChange={e => setNyttTel(e.target.value)} className={field} />
                  </div>
                </div>
                <p className="text-muted text-xs">
                  Företaget läggs till i ditt nätverk automatiskt.
                </p>
              </div>
            )}

            <div>
              <label className="block text-sm mb-1.5">Anteckning</label>
              <input value={placeringNote} onChange={e => setPlaceringNote(e.target.value)} placeholder="Hur kontakten kom till, vad som överenskommits" className={field} />
            </div>

            <div className="flex gap-2">
              <button type="submit" disabled={busy} className="bg-text text-paper rounded-full px-6 py-2.5 text-sm font-medium hover:opacity-85 transition disabled:opacity-40">
                {busy ? 'Sparar' : 'Placera'}
              </button>
              <button type="button" onClick={() => setPlacera(null)} className="text-muted text-sm px-4">
                Avbryt
              </button>
            </div>
          </form>
        )}

        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Sök namn, e-post eller klass"
          className="bg-card border border-line rounded-lg px-4 py-2.5 text-sm w-full sm:w-72 outline-none focus:border-text/40 transition mb-5"
        />

        {visible.length === 0 ? (
          <div className="bg-card border border-line rounded-xl p-12 text-center">
            <p className="mb-1">{students.length === 0 ? 'Inga studenter än' : 'Inga träffar'}</p>
            <p className="text-muted text-sm">
              {students.length === 0
                ? 'Lägg till dem själv eller dela YH-koden så ansluter de sig.'
                : 'Prova en annan sökning.'}
            </p>
          </div>
        ) : (
          <>
            <div className="hidden md:block bg-card border border-line rounded-xl overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-line">
                    <th className="text-left px-5 py-3.5 text-xs font-medium text-muted">Student</th>
                    <th className="text-left px-5 py-3.5 text-xs font-medium text-muted">Klass</th>
                    {perioder.map(p => (
                      <th key={p.id} className="text-left px-5 py-3.5 text-xs font-medium text-muted whitespace-nowrap">
                        {p.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visible.map(s => (
                    <tr key={s.id} className="border-b border-line last:border-0 hover:bg-paper/60 transition">
                      <td className="px-5 py-4">
                        <p className="text-sm font-medium">{s.profiles?.full_name}</p>
                        <p className="text-muted text-xs">{s.profiles?.city || 'Ort saknas'}</p>
                      </td>
                      <td className="px-5 py-4 text-sm text-muted whitespace-nowrap">
                        {s.classes?.name || '—'}
                      </td>
                      {perioder.map(p => {
                        const pl = placeringar.find(
                          x => x.student_id === s.id && x.lia_period_id === p.id
                        )
                        if (!pl) return <td key={p.id} className="px-5 py-4 text-muted text-sm">—</td>

                        const w = weeksUntil(p.start_date)
                        const urgent = pl.status === 'söker' && w !== null && w <= 8
                        const kanPlacera = ['söker', 'uppskjuten', 'matchad'].includes(pl.status)

                        return (
                          <td key={p.id} className="px-5 py-4">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap ${statusStyle[pl.status] || 'bg-muted/10 text-muted'}`}>
                              {pl.status}
                            </span>
                            {pl.companies?.company_name && (
                              <p className="text-muted text-xs mt-1">{pl.companies.company_name}</p>
                            )}
                            {urgent && <p className="text-alert text-xs mt-1">{w} v kvar</p>}
                            {kanPlacera && (
                              <button
                                onClick={() => oppnaPlacera(s, p, pl)}
                                className="text-muted hover:text-text text-xs mt-1.5 block underline underline-offset-2 transition"
                              >
                                {pl.companies ? 'Byt företag' : 'Placera'}
                              </button>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="md:hidden space-y-2.5">
              {visible.map(s => (
                <div key={s.id} className="bg-card border border-line rounded-xl p-4">
                  <p className="text-sm font-medium">{s.profiles?.full_name}</p>
                  <p className="text-muted text-xs mb-3">
                    {s.classes?.name}{s.profiles?.city ? `, ${s.profiles.city}` : ''}
                  </p>
                  <div className="space-y-2">
                    {perioder.map(p => {
                      const pl = placeringar.find(
                        x => x.student_id === s.id && x.lia_period_id === p.id
                      )
                      if (!pl) return null
                      const kanPlacera = ['söker', 'uppskjuten', 'matchad'].includes(pl.status)
                      return (
                        <div key={p.id} className="flex items-center justify-between gap-2">
                          <span className="text-sm text-muted">{p.name}</span>
                          <div className="flex items-center gap-2">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusStyle[pl.status] || 'bg-muted/10 text-muted'}`}>
                              {pl.status}
                            </span>
                            {kanPlacera && (
                              <button onClick={() => oppnaPlacera(s, p, pl)} className="text-muted text-xs underline underline-offset-2">
                                Placera
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  )
}
