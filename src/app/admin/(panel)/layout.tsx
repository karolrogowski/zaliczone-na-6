import Link from 'next/link'
import { adminLogout } from '@/domains/admin/actions'
import { getCurrentProfile } from '@/domains/auth/queries'

const NAV = [
  { href: '/admin/dashboard', label: 'Podsumowanie' },
  { href: '/admin/sessions', label: 'Sesje' },
  { href: '/admin/users', label: 'Użytkownicy' },
  { href: '/admin/config', label: 'Konfiguracja' },
]

export default async function AdminPanelLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const profile = await getCurrentProfile()

  return (
    <div className="min-h-screen flex bg-zinc-100">
      <aside className="w-56 shrink-0 flex flex-col bg-zinc-900 text-zinc-300">
        <div className="px-5 py-6 border-b border-zinc-700">
          <p className="text-xs font-medium uppercase tracking-widest text-zinc-500 mb-1">
            Admin
          </p>
          <p className="text-sm font-semibold text-white">{profile?.full_name}</p>
        </div>
        <nav className="flex-1 py-4">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block px-5 py-2.5 text-sm hover:bg-zinc-800 hover:text-white transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-zinc-700 p-4">
          <form action={adminLogout}>
            <button
              type="submit"
              className="cursor-pointer w-full rounded-lg px-3 py-2 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors text-left"
            >
              Wyloguj
            </button>
          </form>
        </div>
      </aside>
      <main className="flex-1 overflow-auto p-8">{children}</main>
    </div>
  )
}
