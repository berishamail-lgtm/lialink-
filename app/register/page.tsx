'use client'
import { useState } from 'react'
import { createClient } from '../lib/supabase'
import { useRouter } from 'next/navigation'

export default function RegisterPage() {
  const [fullName, setFullName]   = useState('')
  const [email, setEmail]         = useState('')
  const [password, setPassword]   = useState('')
  const [role, setRole]           = useState('student')
  const [error, setError]         = useState('')
  const [loading, setLoading]     = useState(false)
  const router   = useRouter()
  const supabase = createClient()

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, role }
      }
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    router.push('/register/confirm')
  }

  return (
    <div className="min-h-screen bg-[#0f0e0d] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-8 w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold">
            LIA<span className="text-[#e8420a]">link</span>
          </h1>
          <p className="text-gray-500 mt-2">Skapa ditt konto</p>
        </div>

        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold mb-1">Namn</label>
            <input
              type="text"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              placeholder="Förnamn Efternamn"
              required
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-gray-800"
            />
          </div>

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
              placeholder="Minst 6 tecken"
              required
              minLength={6}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-gray-800"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">Jag är…</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: 'student',   label: '🎓 Student' },
                { value: 'company',   label: '🏢 Företag' },
                { value: 'education', label: '📊 Utbildning' },
              ].map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setRole(opt.value)}
                  className={`py-3 px-2 rounded-xl text-xs font-semibold border-2 transition ${
                    role === opt.value
                      ? 'border-[#0f0e0d] bg-[#0f0e0d] text-white'
                      : 'border-gray-200 text-gray-600 hover:border-gray-400'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <p className="text-[#e8420a] text-sm">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#0f0e0d] text-white rounded-full py-3 font-bold text-sm hover:opacity-80 transition disabled:opacity-50"
          >
            {loading ? 'Skapar konto…' : 'Skapa konto →'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-400 mt-6">
          Har du redan konto?{' '}
          <a href="/login" className="text-[#e8420a] font-semibold">
            Logga in
          </a>
        </p>
      </div>
    </div>
  )
}