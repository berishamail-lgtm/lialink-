'use client'
import { useEffect, useState } from 'react'
import { createClient } from '../../../lib/supabase'
import { useRouter } from 'next/navigation'
import AdminSidebar from '../../../components/AdminSidebar'

const rollText: Record<string, string> = {
  education: 'Utbildningsledare',
  company:   'Företag',
  student:   'Studerande',
}

const rollStil: Record<string, string> = {
  education: 'bg-ok/10 text-ok',
  company:   'bg-[#2563eb]/10 text-[#2563eb]',
  student:   'bg-accent/10 text-accent',
}

export default function AdminAnvandare() {
  const [profile, setProfile] = useState<any>(null)
  const [rader, setRader]     = useState<any[]>([])
  const [extra, setExtra]     = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [sok, setSok]         = useState('')
  const [filter, setFilter]   = useState('alla')
  const [sidor, setSidor]     = useState(1)

  const supabase = createClient()
  const router   = useRouter()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: prof } = await supabase
        .from('profiles').select('*').eq('id', user.id).single()
      setProfile(prof)

      if (!prof?.is_admin) { setLoading(false); return }

      const { data: alla } = await supabase
        .from('profiles').select('*').order('created_at', { ascending: false })
      setRader(alla || [])

      // Vilken organisation hör var och en till
      const info: Record<string, string> = {}

      const { data: edus } = await supabase
        .from('educations').select('user_id, program_name, school_name')
      for (const e of edus || []) {
        const fanns = info[e.user_id]
        info[e.user_id] = fanns
          ? fanns + ', ' + e.program_name
          : e.school_name + ' — ' + e.program_name
      }

      const { data: cos } = await supabase
        .from('companies').select('user_id, company_name, city')
      for (const c of cos || []) {
        if (c.user_id) info[c.user_id] = c.company_name + (c.city ? ', ' + c.city : '')
      }

      const { data: medlem } = await supabase
        .from('company_members').select('user_id, companies(company_name)')
      for (const m of medlem || []) {
        if (info[m.user_id]) continue
        const co = Array.isArray((m as any).companies) ? (m as any).companies[0] : (m as any).companies
        if (co?.company_name) info[m.user_id] = co.company_name + ' (handledare)'
      }

      const { data: studs } = await supabase
        .from('students').select('user_id, program, classes(name)')
      for (const s of studs || []) {
        const kl = Array.isArray((s as any).classes) ? (s as any).classes[0] : (s as any).classes
        info[s.user_id] = (s.program || '') + (kl?.name ? ', ' + kl.name : '')
      }

      setExtra(info)
      setLoading(false)
    }
    load()
  }, [])

  const synliga = rader.filter(r => {
    if (filter !== 'alla' && r.role !== filter) return false
    if (!sok.trim()) return true
    const q = sok.toLowerCase()
    return (r.full_name || '').toLowerCase().includes(q)
        || (r.email || '').toLowerCase().includes(q)
        || (extra[r.id] || '').toLowerCase().includes(q)
  })

  const visade = synliga.slice(0, sidor * 30)

  if (loading) return (
    <div className="min-h-screen bg-paper flex items-center justify-center">
      <p className="text-muted text-sm">Laddar</p>
    </div>
  )

  if (!profile?.is_admin) return (
    <div className="min-h-screen bg-paper flex items-center justify-center p-4">
      <div className="bg-card border border-line rounded-xl p-8 max-w-md text-center text-text">
        <p className="mb-1">Ingen åtkomst</p>
        <p className="text-muted text-sm">
          Den här delen är endast för plattformsadministratörer.
        </p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-paper text-text flex flex-col lg:flex-row">
      <AdminSidebar name={profile?.full_name} />

      <main className="flex-1 p-5 sm:p-8 max-w-4xl">
        <h1 className="text-2xl sm:text-3xl mb-1">Användare</h1>
        <p className="text-muted text-sm mb-6">
          Alla konton på plattformen. {rader.length} totalt.
        </p>

        <input
          value={sok}
          onChange={e => { setSok(e.target.value); setSidor(1) }}
          placeholder="Sök namn, e-post, skola eller företag"
          className="bg-card border border-line rounded-lg px-4 py-2.5 text-sm w-full sm:w-80 outline-none focus:border-text/40 transition mb-4"
        />

        <div className="flex flex-wrap gap-1.5 mb-5">
          {[
            { v: 'alla',      t: 'Alla' },
            { v: 'education', t: 'Utbildningsledare' },
            { v: 'company',   t: 'Företag' },
            { v: 'student',   t: 'Studerande' },
          ].map(f => {
            const n = f.v === 'alla' ? rader.length : rader.filter(r => r.role === f.v).length
            return (
              <button
                key={f.v}
                onClick={() => { setFilter(f.v); setSidor(1) }}
                className={'px-3.5 py-2 rounded-full text-sm transition ' +
                  (filter === f.v ? 'bg-text text-paper' : 'bg-card border border-line text-muted hover:border-text/30')}
              >
                {f.t} <span className="opacity-50">{n}</span>
              </button>
            )
          })}
        </div>

        {synliga.length === 0 ? (
          <div className="bg-card border border-line rounded-xl p-12 text-center">
            <p className="mb-1">Inga träffar</p>
            <p className="text-muted text-sm">Prova en annan sökning eller ett annat filter.</p>
          </div>
        ) : (
          <>
            <div className="bg-card border border-line rounded-xl divide-y divide-line">
              {visade.map(r => (
                <div key={r.id} className="px-5 py-4 flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium">{r.full_name || 'Namn saknas'}</p>
                      {r.is_admin && (
                        <span className="bg-accent/10 text-accent rounded-full px-2.5 py-0.5 text-xs">admin</span>
                      )}
                    </div>
                    <p className="text-muted text-sm mt-0.5">{r.email}</p>
                    {extra[r.id] && (
                      <p className="text-muted text-sm">{extra[r.id]}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <span className={'rounded-full px-2.5 py-0.5 text-xs ' + (rollStil[r.role] || 'bg-muted/10 text-muted')}>
                      {rollText[r.role] || r.role}
                    </span>
                    {r.created_at && (
                      <p className="text-muted text-xs mt-1.5">
                        {new Date(r.created_at).toLocaleDateString('sv-SE')}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {synliga.length > visade.length && (
              <button
                onClick={() => setSidor(sidor + 1)}
                className="w-full border border-line rounded-xl py-3 text-sm text-muted hover:border-text/30 transition mt-3"
              >
                Visa fler ({synliga.length - visade.length} kvar)
              </button>
            )}
          </>
        )}
      </main>
    </div>
  )
}
