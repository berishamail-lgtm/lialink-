'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '../lib/supabase'

const items = [
  { href: '/dashboard/education',   label: 'Översikt' },
  { href: '/dashboard/students',    label: 'Studenter' },
  { href: '/dashboard/agreements',  label: 'Avtal' },
  { href: '/dashboard/messages',    label: 'Meddelanden' },
]

export default function Sidebar({ name, program }: { name?: string; program?: string }) {
  const pathname = usePathname()
  const router   = useRouter()
  const supabase = createClient()

  async function logout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <aside className="w-full lg:w-56 lg:min-h-screen bg-ink text-white flex lg:flex-col shrink-0">
      <div className="p-5 lg:pb-8">
        <Link href="/dashboard/education" className="font-display font-extrabold text-lg">
          LIA<span className="text-accent">link</span>
        </Link>
      </div>

      <nav className="flex lg:flex-col gap-1 px-3 overflow-x-auto lg:overflow-visible lg:flex-1">
        {items.map(item => {
          const active = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`px-3 py-2.5 rounded-lg text-sm whitespace-nowrap transition ${
                active
                  ? 'bg-accent/15 text-accent-soft'
                  : 'text-white/45 hover:text-white hover:bg-white/5'
              }`}
            >
              {item.label}
            </Link>
          )
        })}
        <a href="/api/export" className="px-3 py-2.5 rounded-lg text-sm whitespace-nowrap text-white/45 hover:text-white hover:bg-white/5 transition">MYH-rapport</a>
      </nav>

      <div className="hidden lg:block p-5 border-t border-white/10">
        <p className="text-white/30 text-xs mb-1">Inloggad som</p>
        <p className="text-sm font-medium truncate">{name}</p>
        <p className="text-white/35 text-xs truncate mb-3">{program}</p>
        <button onClick={logout} className="text-white/45 hover:text-white text-xs transition">
          Logga ut
        </button>
      </div>

      <button onClick={logout} className="lg:hidden px-5 text-white/45 text-sm shrink-0">
        Logga ut
      </button>
    </aside>
  )
}