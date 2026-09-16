'use client'
import { useEffect, useState } from 'react'
import { createClient } from '../lib/supabase'
import { useRouter } from 'next/navigation'

export default function NyttLosenord() {
  const [redo, setRedo]         = useState(false)
  const [password, setPassword] = useState('')
  const [repeat, setRepeat]     = useState('')
  const [busy, setBusy]         = useState(false)
  const [error, setError]       = useState('')
  const supabase = createClient()
  const router   = useRouter()

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') setRedo(true)
    })
    supabase.auth.getSession().then(({ data: s }) => {
      if (s.session) setRedo(true)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  async function spara(e: React.FormEvent) {
    e.preventDefault()
    if (password !== repeat) { setError('Lösenorden är inte lika.'); return }

    setBusy(true)
    setError('')

    const { error: err } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (err) { setError(err.message); return }

    const { data: { user } } = await supabase.auth.getUser()
    const { data: prof } = await supabase
      .from('profiles').select('role').eq('id', user?.id).single()

    router.push(
      prof?.role === 'education' ? '/dashboard/education'
      : prof?.role === 'company' ? '/dashboard/company'
      : '/dashboard/student'
    )
  }

  const field = 'w-full border border-line rounded-lg px-4 py-2.5 text-sm outline-none focus:border-text/40 transition'

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-card rounded-2xl p-8 max-w-md w-full text-text">
        <p className="font-display font-extrabold text-xl mb-6">
          LIA<span className="text-accent">link</span>
        </p>

        {!redo ? (
          <>
            <h1 className="text-xl mb-2">Länken fungerar inte</h1>
            <p className="text-muted text-sm leading-relaxed mb-6">
              Länken kan ha gått ut eller redan använts. Begär en ny så skickar vi
              en fungerande.
            </p>
            <a href="/glomt-losenord" className="inline-block bg-text text-paper rounded-full px-6 py-2.5 text-sm font-medium">
              Begär ny länk
            </a>
          </>
        ) : (
          <>
            <h1 className="text-xl mb-2">Välj ett nytt lösenord</h1>
            <p className="text-muted text-sm leading-relaxed mb-6">
              Du loggas in direkt när du sparat.
            </p>

            {error && (
              <p className="bg-alert/10 border border-alert/25 text-alert text-sm rounded-lg px-4 py-3 mb-4">
                {error}
              </p>
            )}

            <form onSubmit={spara} className="space-y-4">
              <div>
                <label className="block text-sm mb-1.5">Nytt lösenord</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} placeholder="Minst 6 tecken" className={field} />
              </div>
              <div>
                <label className="block text-sm mb-1.5">Upprepa lösenordet</label>
                <input type="password" value={repeat} onChange={e => setRepeat(e.target.value)} required className={field} />
              </div>
              <button type="submit" disabled={busy} className="w-full bg-text text-paper rounded-full py-3 text-sm font-medium hover:opacity-85 transition disabled:opacity-40">
                {busy ? 'Sparar' : 'Spara och logga in'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}