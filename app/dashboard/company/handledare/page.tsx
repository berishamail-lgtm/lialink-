'use client'
import { useEffect, useState } from 'react'
import { createClient } from '../../../lib/supabase'
import { useRouter } from 'next/navigation'
import Sidebar from '../../../components/Sidebar'

export default function HandledarePage() {
  const [profile, setProfile] = useState<any>(null)
  const [company, setCompany] = useState<any>(null)
  const [members, setMembers] = useState<any[]>([])
  const [invites, setInvites] = useState<any[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  const [show, setShow]   = useState(false)
  const [name, setName]   = useState('')
  const [email, setEmail] = useState('')
  const [busy, setBusy]   = useState(false)
  const [error, setError] = useState('')

  const supabase = createClient()
  const router   = useRouter()

  useEffect(() => { load() }, [])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: prof } = await supabase
      .from('profiles').select('*').eq('id', user.id).single()
    setProfile(prof)

    const { data: co } = await supabase
      .from('companies').select('*').eq('user_id', user.id).maybeSingle()
    setCompany(co)
    setIsAdmin(!!co)

    if (co) {
      const { data: m } = await supabase
        .from('company_members')
        .select('*, profiles(full_name, email)')
        .eq('company_id', co.id)
        .order('created_at')
      setMembers(m || [])

      const { data: inv } = await supabase
        .from('member_invites')
        .select('*')
        .eq('company_id', co.id)
        .is('accepted_at', null)
        .order('sent_at', { ascending: false })
      setInvites(inv || [])
    }

    setLoading(false)
  }

  async function bjudIn(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')

    const res = await fetch('/api/bjud-in-handledare', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId: company.id, email, name }),
    })
    const data = await res.json()
    setBusy(false)

    if (!res.ok) { setError(data.error || 'Inbjudan kunde inte skickas'); return }

    setName(''); setEmail(''); setShow(false)
    load()
  }

  async function taBort(id: string) {
    if (!confirm('Ta bort handledaren?')) return
    await supabase.from('company_members').delete().eq('id', id)
    load()
  }

  async function avbrytInbjudan(id: string) {
    await supabase.from('member_invites').delete().eq('id', id)
    load()
  }

  const field = 'w-full bg-paper border border-line rounded-lg px-4 py-2.5 text-sm outline-none focus:border-text/40 transition'

  if (loading) return (
    <div className="min-h-screen bg-paper flex items-center justify-center">
      <p className="text-muted text-sm">Laddar</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-paper text-text flex flex-col lg:flex-row">
      <Sidebar role="company" name={profile?.full_name} subtitle={company?.company_name} />

      <main className="flex-1 p-5 sm:p-8 max-w-3xl">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-2">
          <h1 className="text-2xl sm:text-3xl">Handledare</h1>
          {isAdmin && (
            <button
              onClick={() => { setShow(!show); setError('') }}
              className="bg-accent text-white px-5 py-2.5 rounded-full text-sm font-medium hover:opacity-85 transition"
            >
              {show ? 'Avbryt' : 'Bjud in handledare'}
            </button>
          )}
        </div>
        <p className="text-muted text-sm mb-7">
          Varje handledare får eget konto och ser bara sina egna studenter.
        </p>

        {!isAdmin && (
          <div className="bg-card border border-line rounded-xl p-6 mb-5">
            <p className="text-muted text-sm">
              Bara den som registrerade företaget kan lägga till handledare.
            </p>
          </div>
        )}

        {error && (
          <p className="bg-alert/10 border border-alert/25 text-alert text-sm rounded-lg px-4 py-3 mb-5">
            {error}
          </p>
        )}

        {show && (
          <form onSubmit={bjudIn} className="bg-card border border-line rounded-xl p-6 mb-5 space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm mb-1.5">Namn</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="Anna Andersson" className={field} />
              </div>
              <div>
                <label className="block text-sm mb-1.5">E-post</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="anna@foretag.se" className={field} />
              </div>
            </div>
            <button type="submit" disabled={busy} className="bg-text text-paper rounded-full px-6 py-2.5 text-sm font-medium hover:opacity-85 transition disabled:opacity-40">
              {busy ? 'Skickar' : 'Skicka inbjudan'}
            </button>
          </form>
        )}

        <div className="bg-card border border-line rounded-xl divide-y divide-line mb-5">
          {members.map(m => (
            <div key={m.id} className="px-5 py-4 flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">{m.profiles?.full_name || 'Namn saknas'}</p>
                <p className="text-muted text-sm">{m.profiles?.email}</p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                  m.member_role === 'admin' ? 'bg-text/8 text-text' : 'bg-ok/10 text-ok'
                }`}>
                  {m.member_role === 'admin' ? 'Administratör' : 'Handledare'}
                </span>
                {isAdmin && m.member_role !== 'admin' && (
                  <button onClick={() => taBort(m.id)} className="text-muted hover:text-alert text-sm transition">
                    Ta bort
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {invites.length > 0 && (
          <section>
            <h2 className="text-base mb-1">Väntar på svar</h2>
            <p className="text-muted text-sm mb-3">
              Inbjudningar som ännu inte accepterats.
            </p>
            <div className="bg-card border border-line rounded-xl divide-y divide-line">
              {invites.map(i => (
                <div key={i.id} className="px-5 py-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm">{i.name || i.email}</p>
                    <p className="text-muted text-sm">
                      Skickad {new Date(i.sent_at).toLocaleDateString('sv-SE')}
                    </p>
                  </div>
                  {isAdmin && (
                    <button onClick={() => avbrytInbjudan(i.id)} className="text-muted hover:text-alert text-sm transition shrink-0">
                      Avbryt
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  )
}