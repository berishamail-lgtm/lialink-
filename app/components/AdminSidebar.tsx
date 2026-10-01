'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '../lib/supabase'

const menu = [
  { href: '/dashboard/admin',            label: 'Översikt' },
  { href: '/dashboard/admin/anordnare',  label: 'Anordnare' },
  { href: '/dashboard/admin/anvandare',  label: 'Användare' },
  { href: '/dashboard/admin/drift',      label: 'Drift' },
]

export default function AdminSidebar({ name }: { name?: string }) {
  const pathname = usePathname()
  const router   = useRouter()
  const supabase = createClient()

  async function logout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <aside className="w-full lg:w-56 lg:min-h-screen bg-ink text-white flex lg:flex-col shrink-0 max-w-full overflow-hidden">
      <div className="p-5 lg:pb-5">
        <Link href="/dashboard/admin" className="font-display font-extrabold text-lg">
          LIA<span className="text-accent">link</span>
        </Link>
        <p className="text-white/30 text-xs mt-1">Plattform</p>
      </div>

      <nav className="flex lg:flex-col gap-1 px-3 overflow-x-auto lg:overflow-visible lg:flex-1">
        {menu.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className={'px-3 py-2.5 rounded-lg text-sm whitespace-nowrap transition ' + (
              pathname === item.href
                ? 'bg-accent/15 text-accent-soft'
                : 'text-white/45 hover:text-white hover:bg-white/5'
            )}
          >
            {item.label}
          </Link>
        ))}

       </nav>

      <div className="hidden lg:block p-5 border-t border-white/10">
        <p className="text-white/30 text-xs mb-1">Inloggad som</p>
        <p className="text-sm font-medium truncate">{name}</p>
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