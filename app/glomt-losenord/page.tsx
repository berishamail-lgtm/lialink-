'use client'
import { useState } from 'react'
import { createClient } from '../lib/supabase'

export default function GlomtLosenord() {
  const [email, setEmail] = useState('')
  const [sent, setSent]   = useState(false)
  const [busy, setBusy]   = useState(false)
  const [error, setError] = useState('')
  const supabase = createClient()

  async function skicka(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')

    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/nytt-losenord`,
    })

    setBusy(false)
    if (err) { setError(err.message); return }
    setSent(true)
  }

  const field = 'w-full border border-line rounded-lg px-4 py-2.5 text-sm outline-none focus:border-text/40 transition'

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-card rounded-2xl p-8 max-w-md w-full text-text">
        <p className="font-display font-extrabold text-xl mb-6">
          LIA<span className="text-accent">link</span>
        </p>

        {sent ? (
          <>
            <h1 className="text-xl mb-2">Kolla din e-post</h1>
            <p className="text-muted text-sm leading-relaxed mb-6">
              Finns det ett konto på {email} har vi skickat en länk dit.
              Den gäller i en timme.
            </p>
            <a href="/login" className="inline-block bg-text text-paper rounded-full px-6 py-2.5 text-sm font-medium">
              Tillbaka till inloggningen
            </a>
          </>
        ) : (
          <>
            <h1 className="text-xl mb-2">Glömt lösenordet?</h1>
            <p className="text-muted text-sm leading-relaxed mb-6">
              Skriv din e-postadress så skickar vi en länk där du väljer ett nytt.
            </p>

            {error && (
              <p className="bg-alert/10 border border-alert/25 text-alert text-sm rounded-lg px-4 py-3 mb-4">
                {error}
              </p>
            )}

            <form onSubmit={skicka} className="space-y-4">
              <div>
                <label className="block text-sm mb-1.5">E-post</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="din@mail.se" className={field} />
              </div>
              <button type="submit" disabled={busy} className="w-full bg-text text-paper rounded-full py-3 text-sm font-medium hover:opacity-85 transition disabled:opacity-40">
                {busy ? 'Skickar' : 'Skicka återställningslänk'}
              </button>
            </form>

            <p className="text-center text-muted text-sm mt-6">
              Kom du på det? <a href="/login" className="text-accent">Logga in</a>
            </p>
          </>
        )}
      </div>
    </div>
  )
}