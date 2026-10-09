'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '../lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [obekraftad, setObekraftad] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setObekraftad(false)

    const { data, error: authErr } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    if (authErr) {
      const m = (authErr.message || '').toLowerCase()
      if (m.includes('not confirmed') || m.includes('email not confirmed')) {
        setObekraftad(true)
      } else {
        setError('Fel e-post eller lösenord.')
      }
      setLoading(false)
      return
    }

    const userId = data.user?.id
    if (!userId) {
      setError('Något gick fel. Försök igen.')
      setLoading(false)
      return
    }

    const { data: profil } = await supabase
      .from('profiles')
      .select('role, is_admin')
      .eq('id', userId)
      .maybeSingle()

    if (profil?.is_admin) {
      router.push('/dashboard/admin')
      return
    }

    if (profil?.role === 'student') {
      router.push('/dashboard/student')
    } else if (profil?.role === 'company') {
      router.push('/dashboard/company')
    } else {
      router.push('/dashboard')
    }
  }

  return (
    <div className="min-h-screen bg-ink flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href="/" className="text-2xl font-semibold text-white tracking-tight">
            LIAlink
          </Link>
          <p className="text-sm text-muted mt-2">Logga in på ditt konto</p>
        </div>

        <div className="bg-card border border-line rounded-xl p-6">
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-white mb-1.5">
                E-postadress
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="namn@exempel.se"
                className="w-full px-3 py-2 bg-ink border border-line rounded-lg text-white placeholder:text-muted focus:outline-none focus:border-accent text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-1.5">
                Lösenord
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3 py-2 bg-ink border border-line rounded-lg text-white placeholder:text-muted focus:outline-none focus:border-accent text-sm"
              />
            </div>

            {error && (
              <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            {obekraftad && (
              <div className="text-sm bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-3 space-y-2">
                <p className="text-amber-300 font-medium">
                  Din e-postadress är inte bekräftad än
                </p>
                <p className="text-muted">
                  Du fick ett mejl när kontot skapades. Hittar du det inte – klicka{' '}
                  <Link href="/glomt-losenord" className="text-accent underline">
                    Glömt lösenordet
                  </Link>
                  . Då får du en ny länk som både bekräftar adressen och låter dig välja
                  lösenord. När du valt lösenord är kontot klart.
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-accent text-ink font-medium py-2.5 rounded-lg hover:opacity-90 disabled:opacity-50 transition text-sm"
            >
              {loading ? 'Loggar in…' : 'Logga in →'}
            </button>
          </form>

          <div className="mt-5 pt-5 border-t border-line space-y-2 text-sm">
            <Link href="/glomt-losenord" className="block text-muted hover:text-white transition">
              Glömt lösenordet?
            </Link>
            <p className="text-muted">
              Har du inget konto?{' '}
              <Link href="/registrera" className="text-accent hover:underline">
                Registrera dig
              </Link>
            </p>
          </div>
        </div>

        <p className="text-xs text-muted text-center mt-6">
          Problem med inloggningen? Kontakta din utbildningsledare.
        </p>
      </div>
    </div>
  )
}
