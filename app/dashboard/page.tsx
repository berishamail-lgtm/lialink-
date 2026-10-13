'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../lib/supabase'

// /dashboard har ingen egen vy — varje roll har sin. Sidan finns för att
// länkar, bokmärken och gamla mejl som pekar hit ska hamna rätt i stället
// för på 404.

export default function DashboardRouter() {
  const router   = useRouter()
  const supabase = createClient()

  useEffect(() => {
    let avbruten = false

    async function vidare() {
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user

      if (avbruten) return

      if (!user) { router.replace('/login'); return }

      const { data: profil } = await supabase
        .from('profiles')
        .select('role, is_admin')
        .eq('id', user.id)
        .maybeSingle()

      if (avbruten) return

      if (profil?.is_admin)                router.replace('/dashboard/admin')
      else if (profil?.role === 'student') router.replace('/dashboard/student')
      else if (profil?.role === 'company') router.replace('/dashboard/company')
      else                                 router.replace('/dashboard/education')
    }

    vidare()
    return () => { avbruten = true }
  }, [])

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center">
      <p className="text-muted text-sm">Laddar</p>
    </div>
  )
}
