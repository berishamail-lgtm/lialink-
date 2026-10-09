'use client'
import { useEffect, useState } from 'react'
import { createClient } from '../../../lib/supabase'
import { hamtaMittForetag } from '../../../lib/foretag'
import { useRouter } from 'next/navigation'
import Sidebar from '../../../components/Sidebar'

const BRANSCHER = [
  'IT och digital', 'Teknik och industri', 'Marknad och reklam',
  'Handel och e-handel', 'Vård och omsorg', 'Konsult och rådgivning',
  'Media och kommunikation', 'Utbildning', 'Annat',
]

type Plats = {
  id: string
  handledare_id: string | null
  titel: string
  beskrivning: string | null
  kompetenser: string[]
  bransch: string | null
  ort: string | null
  period_start: string | null
  period_end: string | null
  antal: number
  antal_lediga: number
  open_to: string
  status: string
}

const tomPlats = {
  titel: '', beskrivning: '', kompetenser: '', bransch: '', ort: '',
  period_start: '', period_end: '', antal: '1', open_to: 'alla',
  handledare_id: '',
}

export default function PlatserPage() {
  const [profile, setProfile] = useState<any>(null)
  const [company, setCompany] = useState<any>(null)
  const [farAdm, setFarAdm]   = useState(false)
  const [minPost, setMinPost] = useState<string | null>(null)

  const [platser, setPlatser]       = useState<Plats[]>([])
  const [handledare, setHandledare] = useState<any[]>([])
  const [educations, setEducations] = useState<any[]>([])
  const [valdaEdu, setValdaEdu]     = useState<string[]>([])
  const [loading, setLoading]       = useState(true)

  const [form, setForm]       = useState<any>(tomPlats)
  const [redigerar, setRedigerar] = useState<string | null>(null)
  const [visaNy, setVisaNy]   = useState(false)
  const [busy, setBusy]       = useState(false)
  const [error, setError]     = useState('')

  const supabase = createClient()
  const router   = useRouter()

  useEffect(() => { load() }, [])

  async function load() {
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
    if (!user) { router.push('/login'); return }

    const { data: prof } = await supabase
      .from('profiles').select('*').eq('id', user.id).maybeSingle()
    setProfile(prof)

    const mitt = await hamtaMittForetag(supabase, user.id)
    setCompany(mitt.company)
    setFarAdm(mitt.farAdministrera)

    if (!mitt.company) { setLoading(false); return }

    const { data: h } = await supabase
      .from('handledare')
      .select('id, name, roll, user_id, aktiv')
      .eq('company_id', mitt.company.id)
      .eq('aktiv', true)
      .order('name')
    setHandledare(h || [])
    setMinPost((h || []).find((x: any) => x.user_id === user.id)?.id || null)

    const { data: p } = await supabase
      .from('lia_platser')
      .select('*')
      .eq('company_id', mitt.company.id)
      .order('created_at', { ascending: false })
    setPlatser((p || []) as Plats[])

    const { data: alla } = await supabase
      .from('educations').select('id, school_name, program_name').order('school_name')
    setEducations(alla || [])

    setLoading(false)
  }

  // En handledare utan adminrätt får bara röra sina egna platser.
  function farAndra(p: Plats) {
    return farAdm || (!!minPost && p.handledare_id === minPost)
  }

  function nollstall() {
    setForm(tomPlats); setValdaEdu([]); setRedigerar(null); setVisaNy(false); setError('')
  }

  function borjaNy() {
    setForm({ ...tomPlats, handledare_id: farAdm ? '' : (minPost || '') })
    setValdaEdu([]); setRedigerar(null); setVisaNy(true); setError('')
  }

  async function borjaRedigera(p: Plats) {
    setForm({
      titel:         p.titel,
      beskrivning:   p.beskrivning || '',
      kompetenser:   (p.kompetenser || []).join(', '),
      bransch:       p.bransch || '',
      ort:           p.ort || '',
      period_start:  p.period_start || '',
      period_end:    p.period_end || '',
      antal:         String(p.antal || 1),
      open_to:       p.open_to || 'alla',
      handledare_id: p.handledare_id || '',
    })

    const { data } = await supabase
      .from('plats_educations').select('education_id').eq('plats_id', p.id)
    setValdaEdu((data || []).map((r: any) => r.education_id))

    setRedigerar(p.id); setVisaNy(false); setError('')
  }

  function vaxlaEdu(id: string) {
    setValdaEdu(valdaEdu.includes(id) ? valdaEdu.filter(v => v !== id) : [...valdaEdu, id])
  }

  async function spara(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setError('')

    const antal = Math.max(parseInt(form.antal) || 1, 1)

    const payload: any = {
      titel:         form.titel.trim(),
      beskrivning:   form.beskrivning.trim() || null,
      kompetenser:   form.kompetenser
                       .split(',')
                       .map((s: string) => s.trim())
                       .filter(Boolean),
      bransch:       form.bransch || null,
      ort:           form.ort.trim() || null,
      period_start:  form.period_start || null,
      period_end:    form.period_end || null,
      antal,
      open_to:       form.open_to,
      handledare_id: form.handledare_id || null,
      updated_at:    new Date().toISOString(),
    }

    let platsId = redigerar

    if (redigerar) {
      const { error: err } = await supabase
        .from('lia_platser').update(payload).eq('id', redigerar)
      if (err) { setError(err.message); setBusy(false); return }
    } else {
      const { data: ny, error: err } = await supabase
        .from('lia_platser')
        .insert({
          ...payload,
          company_id:   company.id,
          antal_lediga: antal,
          created_by:   profile?.id || null,
        })
        .select('id').single()
      if (err) { setError(err.message); setBusy(false); return }
      platsId = ny.id
    }

    if (platsId) {
      await supabase.from('plats_educations').delete().eq('plats_id', platsId)
      if (form.open_to === 'valda' && valdaEdu.length) {
        await supabase.from('plats_educations').insert(
          valdaEdu.map(eduId => ({ plats_id: platsId, education_id: eduId }))
        )
      }
    }

    setBusy(false)
    nollstall()
    load()
  }

  async function bytStatus(p: Plats, status: string) {
    await supabase.from('lia_platser').update({ status, updated_at: new Date().toISOString() }).eq('id', p.id)
    load()
  }

  async function taBort(p: Plats) {
    if (!confirm('Ta bort platsen "' + p.titel + '"?')) return
    await supabase.from('lia_platser').delete().eq('id', p.id)
    load()
  }

  const field = 'w-full bg-paper border border-line rounded-lg px-4 py-2.5 text-sm outline-none focus:border-text/40 transition'

  if (loading) return (
    <div className="min-h-screen bg-paper flex items-center justify-center">
      <p className="text-muted text-sm">Laddar</p>
    </div>
  )

  const statusText: Record<string, string> = {
    oppen: 'Öppen', pausad: 'Pausad', fylld: 'Fylld',
  }
  const statusStil: Record<string, string> = {
    oppen:  'bg-ok/10 text-ok',
    pausad: 'bg-text/8 text-muted',
    fylld:  'bg-warn/10 text-warn',
  }

  const formular = (
    <form onSubmit={spara} className="bg-card border border-line rounded-xl p-6 mb-5 space-y-4">
      <div>
        <label className="block text-sm mb-1.5">Vad söker ni?</label>
        <input
          value={form.titel}
          onChange={e => setForm({ ...form, titel: e.target.value })}
          required
          placeholder="PLC-programmerare"
          className={field}
        />
        <p className="text-muted text-xs mt-1.5">
          Kort och konkret. Det här är rubriken studenten ser.
        </p>
      </div>

      <div>
        <label className="block text-sm mb-1.5">Beskrivning</label>
        <textarea
          value={form.beskrivning}
          onChange={e => setForm({ ...form, beskrivning: e.target.value })}
          rows={3}
          placeholder="Vad studenten får göra, vilka system ni jobbar i, hur upplärningen ser ut."
          className={field + ' resize-y'}
        />
      </div>

      <div>
        <label className="block text-sm mb-1.5">Kompetenser</label>
        <input
          value={form.kompetenser}
          onChange={e => setForm({ ...form, kompetenser: e.target.value })}
          placeholder="Siemens TIA, ellära, felsökning"
          className={field}
        />
        <p className="text-muted text-xs mt-1.5">
          Separera med komma. Matchningen väger dessa mot studentens profil.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm mb-1.5">Handledare</label>
          <select
            value={form.handledare_id}
            onChange={e => setForm({ ...form, handledare_id: e.target.value })}
            disabled={!farAdm}
            className={field + (farAdm ? '' : ' opacity-60')}
          >
            <option value="">Ingen vald än</option>
            {handledare.map(h => (
              <option key={h.id} value={h.id}>
                {h.name}{h.roll ? ' — ' + h.roll : ''}
              </option>
            ))}
          </select>
          {!farAdm && (
            <p className="text-muted text-xs mt-1.5">Platsen läggs på dig.</p>
          )}
        </div>
        <div>
          <label className="block text-sm mb-1.5">Bransch</label>
          <select
            value={form.bransch}
            onChange={e => setForm({ ...form, bransch: e.target.value })}
            className={field}
          >
            <option value="">Välj</option>
            {BRANSCHER.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm mb-1.5">Ort</label>
          <input
            value={form.ort}
            onChange={e => setForm({ ...form, ort: e.target.value })}
            placeholder={company?.city || 'Malmö'}
            className={field}
          />
        </div>
        <div>
          <label className="block text-sm mb-1.5">Antal platser</label>
          <input
            type="number" min={1}
            value={form.antal}
            onChange={e => setForm({ ...form, antal: e.target.value })}
            className={field}
          />
        </div>
        <div>
          <label className="block text-sm mb-1.5">Period från</label>
          <input
            type="date"
            value={form.period_start}
            onChange={e => setForm({ ...form, period_start: e.target.value })}
            className={field}
          />
        </div>
        <div>
          <label className="block text-sm mb-1.5">Period till</label>
          <input
            type="date"
            value={form.period_end}
            onChange={e => setForm({ ...form, period_end: e.target.value })}
            className={field}
          />
        </div>
      </div>

      <div>
        <p className="text-sm mb-2">Vilka utbildningar tar ni emot från?</p>
        <div className="flex gap-4 mb-3">
          {[
            { v: 'alla',  t: 'Alla utbildningar' },
            { v: 'valda', t: 'Bara valda' },
          ].map(o => (
            <label key={o.v} className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="radio"
                checked={form.open_to === o.v}
                onChange={() => setForm({ ...form, open_to: o.v })}
              />
              {o.t}
            </label>
          ))}
        </div>

        {form.open_to === 'valda' && (
          <div className="border border-line rounded-lg divide-y divide-line max-h-56 overflow-y-auto">
            {educations.map(e => (
              <label key={e.id} className="flex items-center gap-3 px-4 py-2.5 text-sm cursor-pointer hover:bg-paper/60">
                <input
                  type="checkbox"
                  checked={valdaEdu.includes(e.id)}
                  onChange={() => vaxlaEdu(e.id)}
                />
                <span className="min-w-0">
                  {e.program_name}
                  <span className="text-muted"> — {e.school_name}</span>
                </span>
              </label>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-2 pt-1">
        <button type="submit" disabled={busy} className="bg-text text-paper rounded-full px-6 py-2.5 text-sm font-medium hover:opacity-85 transition disabled:opacity-40">
          {busy ? 'Sparar' : redigerar ? 'Spara ändringar' : 'Lägg upp platsen'}
        </button>
        <button type="button" onClick={nollstall} className="text-muted text-sm px-3">
          Avbryt
        </button>
      </div>
    </form>
  )

  return (
    <div className="min-h-screen bg-paper text-text flex flex-col lg:flex-row">
      <Sidebar role="company" name={profile?.full_name} subtitle={company?.company_name} />

      <main className="flex-1 p-5 sm:p-8 max-w-3xl">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-2">
          <h1 className="text-2xl sm:text-3xl">Våra LIA-platser</h1>
          {company && !visaNy && !redigerar && (
            <button
              onClick={borjaNy}
              className="bg-accent text-white px-5 py-2.5 rounded-full text-sm font-medium hover:opacity-85 transition"
            >
              Ny plats
            </button>
          )}
        </div>
        <p className="text-muted text-sm mb-7">
          En plats per behov. Söker ni en PLC-student och en fibertekniker blir det
          två platser med olika kompetenser och olika handledare — matchningen
          poängsätter varje plats för sig.
        </p>

        {error && (
          <p className="bg-alert/10 border border-alert/25 text-alert text-sm rounded-lg px-4 py-3 mb-5">{error}</p>
        )}

        {!company ? (
          <div className="bg-card border border-line rounded-xl p-6">
            <p className="text-muted text-sm">
              Ditt konto är inte kopplat till något företag ännu.
            </p>
          </div>
        ) : (
          <>
            {(visaNy || redigerar) && formular}

            {platser.length === 0 ? (
              <div className="bg-card border border-line rounded-xl p-10 text-center">
                <p className="mb-1">Inga platser upplagda</p>
                <p className="text-muted text-sm">
                  Lägg upp en plats så börjar studenter matchas mot just det behovet.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {platser.map(p => {
                  const h    = handledare.find(x => x.id === p.handledare_id)
                  const mina = farAndra(p)

                  return (
                    <article key={p.id} className="bg-card border border-line rounded-xl p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
                        <div className="min-w-0">
                          <h2 className="text-base">{p.titel}</h2>
                          <p className="text-muted text-sm mt-0.5">
                            {h ? h.name : 'Ingen handledare vald'}
                            {p.ort ? ', ' + p.ort : ''}
                          </p>
                          {(p.period_start || p.period_end) && (
                            <p className="text-muted text-sm">
                              {p.period_start || '?'} till {p.period_end || '?'}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={'px-2.5 py-1 rounded-full text-xs font-medium ' + (statusStil[p.status] || '')}>
                            {statusText[p.status] || p.status}
                          </span>
                          <span className="text-muted text-sm">
                            {p.antal} {p.antal === 1 ? 'plats' : 'platser'}
                          </span>
                        </div>
                      </div>

                      {p.beskrivning && (
                        <p className="text-sm leading-relaxed mb-3">{p.beskrivning}</p>
                      )}

                      {p.kompetenser?.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          {p.kompetenser.map(k => (
                            <span key={k} className="bg-paper border border-line rounded-full px-2.5 py-1 text-xs text-muted">
                              {k}
                            </span>
                          ))}
                        </div>
                      )}

                      {p.open_to === 'valda' && (
                        <p className="text-muted text-xs mb-3">
                          Begränsad till valda utbildningar.
                        </p>
                      )}

                      {mina && (
                        <div className="flex flex-wrap items-center gap-4 pt-1">
                          <button onClick={() => borjaRedigera(p)} className="text-muted hover:text-text text-sm transition">
                            Ändra
                          </button>
                          {p.status !== 'oppen' && (
                            <button onClick={() => bytStatus(p, 'oppen')} className="text-ok hover:opacity-75 text-sm transition">
                              Öppna
                            </button>
                          )}
                          {p.status === 'oppen' && (
                            <button onClick={() => bytStatus(p, 'pausad')} className="text-muted hover:text-text text-sm transition">
                              Pausa
                            </button>
                          )}
                          {p.status !== 'fylld' && (
                            <button onClick={() => bytStatus(p, 'fylld')} className="text-muted hover:text-text text-sm transition">
                              Markera som fylld
                            </button>
                          )}
                          <button onClick={() => taBort(p)} className="text-muted hover:text-alert text-sm transition">
                            Ta bort
                          </button>
                        </div>
                      )}
                    </article>
                  )
                })}
              </div>
            )}

            <p className="text-muted text-xs mt-5 leading-relaxed">
              En pausad plats matchas inte, men ligger kvar och kan öppnas igen inför
              nästa period. Lämnar du handledaren tom matchas platsen ändå — men då
              vet ingen vem studenten ska vända sig till.
            </p>
          </>
        )}
      </main>
    </div>
  )
}
