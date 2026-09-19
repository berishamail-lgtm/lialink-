'use client'
import { useEffect, useState } from 'react'
import { createClient } from '../../lib/supabase'
import { useRouter } from 'next/navigation'
import Sidebar from '../../components/Sidebar'
import { useEdu } from '../../components/EduContext'

export default function RapporterPage() {
  const [profile, setProfile]       = useState<any>(null)
  const [klasser, setKlasser]       = useState<any[]>([])
  const [students, setStudents]     = useState<any[]>([])
  const [perioder, setPerioder]     = useState<any[]>([])
  const [placeringar, setPlaceringar] = useState<any[]>([])
  const [agreements, setAgreements] = useState<any[]>([])
  const [utvarderingar, setUtv]     = useState<any[]>([])
  const [valdKlass, setValdKlass]   = useState('alla')
  const [loading, setLoading]       = useState(true)

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
      .from('classes').select('*').eq('education_id', current.id).order('start_date', { ascending: false })
    setKlasser(cls || [])

    const classIds = (cls || []).map(c => c.id)

    if (!classIds.length) {
      setStudents([]); setPerioder([]); setPlaceringar([]); setAgreements([]); setUtv([])
      setLoading(false)
      return
    }

    const { data: studs } = await supabase
      .from('students')
      .select('*, classes(name, termin), profiles(full_name, email, city)')
      .in('class_id', classIds)
    setStudents(studs || [])

    const { data: per } = await supabase
      .from('lia_periods').select('*').in('class_id', classIds).order('sequence')
    setPerioder(per || [])

    const periodIds = (per || []).map(p => p.id)
    if (!periodIds.length) {
      setPlaceringar([]); setAgreements([]); setUtv([])
      setLoading(false)
      return
    }

    const { data: pl } = await supabase
      .from('placements')
      .select('*, lia_periods(name, sequence, class_id, start_date, end_date), students(id, class_id, profiles(full_name)), companies(company_name, org_number, city, sector)')
      .in('lia_period_id', periodIds)
    setPlaceringar(pl || [])

    const plIds = (pl || []).map(p => p.id)
    if (plIds.length) {
      const { data: agr } = await supabase
        .from('agreements').select('*').in('placement_id', plIds)
      setAgreements(agr || [])

      const { data: ev } = await supabase
        .from('evaluations').select('*').in('placement_id', plIds)
      setUtv(ev || [])
    } else {
      setAgreements([]); setUtv([])
    }

    setLoading(false)
  }

  // Filtrera på vald klass
  const klassIds = valdKlass === 'alla'
    ? klasser.map(k => k.id)
    : [valdKlass]

  const filtStudents = students.filter(s => klassIds.includes(s.class_id))
  const filtPerioder = perioder.filter(p => klassIds.includes(p.class_id))
  const filtPlac     = placeringar.filter(p => klassIds.includes(p.lia_periods?.class_id))
  const plIdsFilt    = filtPlac.map(p => p.id)
  const filtAgr      = agreements.filter(a => plIdsFilt.includes(a.placement_id))
  const filtUtv      = utvarderingar.filter(e => plIdsFilt.includes(e.placement_id))

  const totalt    = filtStudents.length
  const medPlats  = filtPlac.filter(p => ['matchad','avtal','aktiv','klar'].includes(p.status)).length
  const signerade = filtAgr.filter(a => a.all_signed).length
  const klara     = filtPlac.filter(p => p.status === 'klar').length
  const besvarade = filtUtv.filter(e => e.status === 'besvarat').length

  const placeringarTotalt = filtPlac.length
  const placeringsgrad    = placeringarTotalt ? Math.round((medPlats / placeringarTotalt) * 100) : 0
  const fullfoljandegrad  = placeringarTotalt ? Math.round((klara / placeringarTotalt) * 100) : 0

  // Åtgärdslista
  const atgarder: any[] = []
  for (const s of filtStudents) {
    const namn = s.profiles?.full_name || 'Okänd student'
    if (!s.profiles?.city) atgarder.push({ id: s.id + 'ort', namn, text: 'ort saknas i profilen' })
    if (!s.skills?.length) atgarder.push({ id: s.id + 'komp', namn, text: 'inga kompetenser angivna' })
  }
  for (const p of filtPlac) {
    const namn = p.students?.profiles?.full_name || 'Okänd student'
    const per  = p.lia_periods?.name || 'LIA'
    if (p.status === 'söker') {
      atgarder.push({ id: p.id + 'plats', namn, text: `saknar plats för ${per}` })
    }
    if (p.status === 'matchad' && !filtAgr.some(a => a.placement_id === p.id)) {
      atgarder.push({ id: p.id + 'avtal', namn, text: `har plats men inget avtal för ${per}` })
    }
    const agr = filtAgr.find(a => a.placement_id === p.id)
    if (agr && !agr.all_signed) {
      atgarder.push({ id: p.id + 'sign', namn, text: `avtal för ${per} inte signerat av alla` })
    }
    if (p.status === 'klar' && !filtUtv.some(e => e.placement_id === p.id && e.status === 'besvarat')) {
      atgarder.push({ id: p.id + 'utv', namn, text: `utvärdering saknas för ${per}` })
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-paper flex items-center justify-center">
      <p className="text-muted text-sm">Laddar</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-paper text-text flex flex-col lg:flex-row">
      <Sidebar role="education" name={profile?.full_name} subtitle={current?.program_name} />

      <main className="flex-1 p-5 sm:p-8 max-w-4xl">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-2">
          <h1 className="text-2xl sm:text-3xl">Underlag till MYH</h1>
          <a
            href={`/api/export?edu=${current?.id}`}
            className="bg-accent text-white px-5 py-2.5 rounded-full text-sm font-medium hover:opacity-85 transition"
          >
            Ladda ner som Excel
          </a>
        </div>
        <p className="text-muted text-sm mb-6">
          {current?.program_name}. Siffrorna räknas fram när sidan laddas.
        </p>

        {klasser.length > 1 && (
          <div className="flex flex-wrap gap-1.5 mb-6">
            <button
              onClick={() => setValdKlass('alla')}
              className={`px-3.5 py-2 rounded-full text-sm transition ${
                valdKlass === 'alla' ? 'bg-text text-paper' : 'bg-card border border-line text-muted hover:border-text/30'
              }`}
            >
              Alla klasser
            </button>
            {klasser.map(k => (
              <button
                key={k.id}
                onClick={() => setValdKlass(k.id)}
                className={`px-3.5 py-2 rounded-full text-sm transition ${
                  valdKlass === k.id ? 'bg-text text-paper' : 'bg-card border border-line text-muted hover:border-text/30'
                }`}
              >
                {k.name}{k.termin ? `, ${k.termin}` : ''}
              </button>
            ))}
          </div>
        )}

        {klasser.length === 0 ? (
          <div className="bg-card border border-line rounded-xl p-12 text-center">
            <p className="mb-1">Inga klasser upplagda</p>
            <p className="text-muted text-sm">
              Lägg upp en klass under Planering så börjar underlaget fyllas.
            </p>
          </div>
        ) : (
          <>
            <section className="bg-card border border-line rounded-xl p-6 mb-4">
              <h2 className="text-base mb-5">Genomförande</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-5">
                {[
                  { n: totalt,                  label: 'inskrivna studenter' },
                  { n: placeringarTotalt,       label: 'LIA-perioder totalt' },
                  { n: medPlats,                label: 'perioder med plats' },
                  { n: signerade,               label: 'avtal signerade av alla' },
                ].map((s, i) => (
                  <div key={i}>
                    <p className="font-display text-3xl font-extrabold">{s.n}</p>
                    <p className="text-muted text-sm mt-1 leading-snug">{s.label}</p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-5 mt-6 pt-6 border-t border-line">
                {[
                  { n: `${placeringsgrad}%`,   label: 'placeringsgrad' },
                  { n: klara,                   label: 'slutförda perioder' },
                  { n: `${fullfoljandegrad}%`, label: 'fullföljandegrad' },
                  { n: besvarade,               label: 'utvärderingar inkomna' },
                ].map((s, i) => (
                  <div key={i}>
                    <p className="font-display text-3xl font-extrabold">{s.n}</p>
                    <p className="text-muted text-sm mt-1 leading-snug">{s.label}</p>
                  </div>
                ))}
              </div>
            </section>

            {filtPerioder.length > 0 && (
              <section className="bg-card border border-line rounded-xl p-6 mb-4">
                <h2 className="text-base mb-1">Per LIA-period</h2>
                <p className="text-muted text-sm mb-5">
                  Hur långt varje period har kommit.
                </p>
                <div className="space-y-3">
                  {filtPerioder.map(per => {
                    const iPer   = filtPlac.filter(p => p.lia_period_id === per.id)
                    const medP   = iPer.filter(p => ['matchad','avtal','aktiv','klar'].includes(p.status)).length
                    const andel  = iPer.length ? Math.round((medP / iPer.length) * 100) : 0
                    return (
                      <div key={per.id}>
                        <div className="flex justify-between text-sm mb-1.5">
                          <span>{per.name}</span>
                          <span className="text-muted">{medP} av {iPer.length}</span>
                        </div>
                        <div className="h-1.5 bg-line rounded-full overflow-hidden">
                          <div className="h-full bg-ok rounded-full transition-[width] duration-500" style={{ width: `${andel}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>
            )}

            <section className="bg-card border border-line rounded-xl p-6">
              <h2 className="text-base mb-1">Att komplettera</h2>
              <p className="text-muted text-sm mb-5">
                Uppgifter som saknas innan underlaget är fullständigt.
              </p>

              {atgarder.length === 0 ? (
                <p className="text-muted text-sm">
                  {totalt === 0 ? 'Inga studenter anslutna än.' : 'Ingenting saknas.'}
                </p>
              ) : (
                <ul className="divide-y divide-line -mx-6">
                  {atgarder.map(a => (
                    <li key={a.id} className="px-6 py-3 flex flex-wrap gap-x-2 text-sm">
                      <span className="font-medium">{a.namn}</span>
                      <span className="text-muted">{a.text}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  )
}
