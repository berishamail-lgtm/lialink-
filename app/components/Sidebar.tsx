'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '../lib/supabase'

type Props = {
  role?: string
  name?: string
  subtitle?: string
}

const menus: Record<string, { href: string; label: string }[]> = {
  education: [
    { href: '/dashboard/education',  label: 'Översikt' },
    { href: '/dashboard/planering',  label: 'Planering' },
    { href: '/dashboard/students',   label: 'Studenter' },
    { href: '/dashboard/natverk',  label: 'Företagsnätverk' },
    { href: '/dashboard/agreements', label: 'Avtal' },
    { href: '/dashboard/messages',   label: 'Meddelanden' },
    { href: '/dashboard/konto', label: 'Mitt konto' },
    { href: '/dashboard/admin', label: 'Administration' },
  ],
  student: [
    { href: '/dashboard/student',        label: 'Min LIA' },
    { href: '/dashboard/student/profil', label: 'Min profil' },
    { href: '/dashboard/agreements',     label: 'Avtal' },
    { href: '/dashboard/messages',       label: 'Meddelanden' },
    { href: '/dashboard/konto', label: 'Mitt konto' },
  ],
  company: [
    { href: '/dashboard/company',        label: 'Kandidater' },
    { href: '/dashboard/company/profil', label: 'Företagsprofil' },
    { href: '/dashboard/agreements',     label: 'Avtal' },
    { href: '/dashboard/messages',       label: 'Meddelanden' },
    { href: '/dashboard/company/handledare', label: 'Handledare' },
    { href: '/dashboard/konto', label: 'Mitt konto' },
  ],
}

export default function Sidebar({ role = 'student', name, subtitle }: Props) {
  const pathname = usePathname()
  const router   = useRouter()
  const supabase = createClient()
  const items    = menus[role] ?? menus.student

  async function logout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
        <aside className="w-full lg:w-56 lg:min-h-screen bg-ink text-white flex lg:flex-col shrink-0 max-w-full overflow-hidden">
      <div className="p-5 lg:pb-8">
        <Link href={items[0].href} className="font-display font-extrabold text-lg">
          LIA<span className="text-accent">link</span>
        </Link>
      </div>

      <nav className="flex lg:flex-col gap-1 px-3 overflow-x-auto lg:overflow-visible lg:flex-1">
        {items.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className={`px-3 py-2.5 rounded-lg text-sm whitespace-nowrap transition ${
              pathname === item.href
                ? 'bg-accent/15 text-accent-soft'
                : 'text-white/45 hover:text-white hover:bg-white/5'
            }`}
          >
            {item.label}
          </Link>
        ))}
        {role === 'education' && (
          <a href="/api/export" className="px-3 py-2.5 rounded-lg text-sm whitespace-nowrap text-white/45 hover:text-white hover:bg-white/5 transition">MYH-rapport</a>
        )}
      </nav>

      <div className="hidden lg:block p-5 border-t border-white/10">
        <p className="text-white/30 text-xs mb-1">Inloggad som</p>
        <p className="text-sm font-medium truncate">{name}</p>
        {subtitle && <p className="text-white/35 text-xs truncate">{subtitle}</p>}
        <button onClick={logout} className="text-white/45 hover:text-white text-xs transition mt-3">
          Logga ut
        </button>
      </div>

      <button onClick={logout} className="lg:hidden px-5 text-white/45 text-sm shrink-0">
        Logga ut
      </button>
          </aside>
  )
}