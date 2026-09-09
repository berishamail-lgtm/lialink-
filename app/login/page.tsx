'use client'
import { useState } from 'react'
import { createClient } from '../lib/supabase'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError('Fel e-post eller lösenord')
      setLoading(false)
      return
    }

    // Hämta roll och skicka till rätt dashboard
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', data.user.id)
      .single()

    if (profile?.role === 'student')   router.push('/dashboard/student')
    if (profile?.role === 'company')   router.push('/dashboard/company')
    if (profile?.role === 'education') router.push('/dashboard/education')
  }

  return (
    <div className="min-h-screen bg-[#0f0e0d] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-8 w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold">
            LIA<span className="text-[#e8420a]">link</span>
          </h1>
          <p className="text-gray-500 mt-2">Logga in på ditt konto</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold mb-1">E-post</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="din@mail.se"
              required
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-gray-800"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1">Lösenord</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-gray-800"
            />
          </div>

          {error && (
            <p className="text-[#e8420a] text-sm">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#0f0e0d] text-white rounded-full py-3 font-bold text-sm hover:opacity-80 transition disabled:opacity-50"
          >
            {loading ? 'Loggar in…' : 'Logga in →'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-400 mt-6">
          Inget konto?{' '}
          <a href="/register" className="text-[#e8420a] font-semibold">
            Registrera dig
          </a>
        </p>
      </div>
    </div>
  )
}