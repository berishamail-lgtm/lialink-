'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '../lib/supabase'

type Props = {
  role?: string
  subtitle?: string
}

export default function Nav({ role, subtitle }: Props) {
  const pathname = usePathname()
  const router   = useRouter()
  const supabase = createClient()

  const home =
    role === 'education' ? '/dashboard/education' :
    role === 'company'   ? '/dashboard/company'   :
    '/dashboard/student'

  const label =
    role === 'education' ? 'Studenter' :
    role === 'company'   ? 'Kandidater' :
    'Matchningar'

  const links = [
    { href: home,                   text: label },
    { href: '/dashboard/messages',  text: 'Meddelanden' },
    { href: '/dashboard/agreements', text: 'Avtal' },
  ]

  async function logout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <header className="border-b border-white/10">
      <div className="max-w-6xl mx-auto px-5 sm:px-8">
        <div className="h-16 flex items-center justify-between gap-4">
          <Link href={home} className="font-display font-extrabold text-xl text-white shrink-0">
            LIA<span className="text-accent">link</span>
          </Link>

          <nav className="hidden sm:flex items-center gap-1 ml-4 mr-auto">
            {links.map(l => (
              <Link
                key={l.href}
                href={l.href}
                className={`text-sm px-3 py-2 rounded-full transition ${
                  pathname === l.href
                    ? 'text-white bg-white/10'
                    : 'text-white/45 hover:text-white'
                }`}
              >
                {l.text}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-4 shrink-0">
            {subtitle && (
              <span className="hidden lg:block text-white/35 text-sm truncate max-w-[260px]">
                {subtitle}
              </span>
            )}
            <button
              onClick={logout}
              className="text-sm text-white/45 hover:text-white transition"
            >
              Logga ut
            </button>
          </div>
        </div>

        <nav className="flex sm:hidden gap-1 pb-3 -mt-1">
          {links.map(l => (
            <Link
              key={l.href}
              href={l.href}
              className={`text-sm px-3 py-1.5 rounded-full transition ${
                pathname === l.href
                  ? 'text-white bg-white/10'
                  : 'text-white/45'
              }`}
            >
              {l.text}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  )
}