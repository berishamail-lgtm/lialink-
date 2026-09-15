'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase'

export default function Valkommen() {
  const { token } = useParams<{ token: string }>()
  const [invite, setInvite]   = useState<any>(null)
  const [status, setStatus]   = useState('laddar')
  const [password, setPassword] = useState('')
  const [name, setName]       = useState('')
  const [error, setError]     = useState('')
  const [saving, setSaving]   = useState(false)

  const supabase = createClient()
  const router   = useRouter()

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('company_invites')
        .select('*, companies(company_name, city, contact_name), educations(school_name, program_name)')
        .eq('token', token)
        .maybeSingle()

      if (!data)                          { setStatus('ogiltig'); return }
      if (data.accepted_at)               { setStatus('använd');  return }
      if (new Date(data.expires_at) < new Date()) { setStatus('utgången'); return }

      setInvite(data)
      setName(data.companies?.contact_name || '')
      setStatus('ok')
    }
    load()
  }, [token])

  async function createAccount(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')

    const { data: signUp, error: authErr } = await supabase.auth.signUp({
      email: invite.email,
      password,
      options: { data: { full_name: name, role: 'company' } },
    })

    if (authErr) { setError(authErr.message); setSaving(false); return }

    const userId = signUp.user?.id
    if (userId) {
      await supabase.from('companies')
        .update({ user_id: userId, claimed: true })
        .eq('id', invite.company_id)

      await supabase.from('company_invites')
        .update({ accepted_at: new Date().toISOString() })
        .eq('id', invite.id)
    }

    router.push('/dashboard/company/profil')
  }

  const field = 'w-full border border-line rounded-lg px-4 py-2.5 text-sm outline-none focus:border-text/40 transition'

  const meddelanden: Record<string, string> = {
    ogiltig:  'Länken stämmer inte. Be utbildningsledaren skicka en ny inbjudan.',
    använd:   'Inbjudan är redan använd. Logga in med kontot ni skapade.',
    utgången: 'Inbjudan har gått ut. Be utbildningsledaren skicka en ny.',
  }

  if (status === 'laddar') return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-white/50 text-sm">Laddar</p>
    </div>
  )

  if (status !== 'ok') return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-card rounded-2xl p-8 max-w-md w-full text-center text-text">
        <p className="font-display font-extrabold text-xl mb-3">
          LIA<span className="text-accent">link</span>
        </p>
        <p className="text-muted text-sm leading-relaxed mb-5">{meddelanden[status]}</p>
        <a href="/login" className="inline-block bg-text text-paper rounded-full px-6 py-2.5 text-sm font-medium">
          Till inloggningen
        </a>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-card rounded-2xl p-8 max-w-md w-full text-text">
        <p className="font-display font-extrabold text-xl mb-6">
          LIA<span className="text-accent">link</span>
        </p>

        <h1 className="text-xl mb-2">Välkommen, {invite.companies?.company_name}</h1>
        <p className="text-muted text-sm leading-relaxed mb-6">
          {invite.educations?.school_name} har bjudit in er att ta emot LIA-studenter
          från {invite.educations?.program_name}. Skapa ett lösenord så är ni igång.
        </p>

        {error && (
          <p className="bg-alert/10 border border-alert/25 text-alert text-sm rounded-lg px-4 py-3 mb-4">
            {error}
          </p>
        )}

        <form onSubmit={createAccount} className="space-y-4">
          <div>
            <label className="block text-sm mb-1.5">Ditt namn</label>
            <input value={name} onChange={e => setName(e.target.value)} required className={field} />
          </div>

          <div>
            <label className="block text-sm mb-1.5">E-post</label>
            <input value={invite.email} disabled className={`${field} bg-paper text-muted`} />
          </div>

          <div>
            <label className="block text-sm mb-1.5">Välj lösenord</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={6}
              placeholder="Minst 6 tecken"
              className={field}
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-text text-paper rounded-full py-3 text-sm font-medium hover:opacity-85 transition disabled:opacity-40"
          >
            {saving ? 'Skapar konto' : 'Skapa konto'}
          </button>
        </form>
      </div>
    </div>
  )
}