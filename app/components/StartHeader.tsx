'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '../lib/supabase'

type Inloggad = {
  epost: string
  mal: string
}

export default function StartHeader() {
  const supabase = createClient()
  const [inloggad, setInloggad] = useState<Inloggad | null>(null)
  const [klar, setKlar] = useState(false)

  useEffect(() => {
    let avbruten = false

    async function las(userId: string, epost: string) {
      const { data: profil } = await supabase
        .from('profiles')
        .select('role, is_admin')
        .eq('id', userId)
        .maybeSingle()

      if (avbruten) return

      let mal = '/dashboard'
      if (profil?.is_admin) mal = '/dashboard/admin'
      else if (profil?.role === 'student') mal = '/dashboard/student'
      else if (profil?.role === 'company') mal = '/dashboard/company'

      setInloggad({ epost, mal })
      setKlar(true)
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (avbruten) return
      if (session?.user) {
        las(session.user.id, session.user.email || '')
      } else {
        setKlar(true)
      }
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (avbruten) return
      if (session?.user) {
        las(session.user.id, session.user.email || '')
      } else {
        setInloggad(null)
        setKlar(true)
      }
    })

    const timeout = setTimeout(() => {
      if (!avbruten) setKlar(true)
    }, 6000)

    return () => {
      avbruten = true
      clearTimeout(timeout)
      sub.subscription.unsubscribe()
    }
  }, [supabase])

  return (
    <>
      <header className="border-b border-white/10">
        <div className="max-w-6xl mx-auto px-6 sm:px-10 h-16 flex items-center justify-between">
          <span className="font-display font-extrabold text-xl text-white">
            LIA<span className="text-accent">link</span>
          </span>

          <nav className="flex items-center gap-2">
            {!klar ? (
              <span className="h-9 w-32" aria-hidden />
            ) : inloggad ? (
              <Link
                href={inloggad.mal}
                className="text-sm font-medium bg-white text-ink px-5 py-2 rounded-full hover:opacity-85 transition"
              >
                Till min sida
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-sm text-white/50 hover:text-white px-4 py-2 rounded-full transition"
                >
                  Logga in
                </Link>
                <Link
                  href="/register"
                  className="text-sm font-medium bg-white text-ink px-5 py-2 rounded-full hover:opacity-85 transition"
                >
                  Skapa konto
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      {inloggad && (
        <div className="border-b border-accent/20 bg-accent/10">
          <div className="max-w-6xl mx-auto px-6 sm:px-10 py-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-white/70">
              Du är inloggad som{' '}
              <span className="text-white font-medium">{inloggad.epost}</span>
            </p>
            <Link
              href={inloggad.mal}
              className="text-sm font-medium text-accent hover:text-white underline underline-offset-4 transition"
            >
              Gå till min sida →
            </Link>
          </div>
        </div>
      )}
    </>
  )
}
