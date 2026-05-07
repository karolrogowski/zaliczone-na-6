import { logout } from '@/domains/auth/actions'
import { getCurrentProfile } from '@/domains/auth/queries'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile()

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <a href="/dashboard" className="font-bold text-zinc-900 hover:text-zinc-600 transition-colors">
            Zaliczone na 6
          </a>
          <div className="flex items-center gap-4">
            <span className="text-sm text-zinc-600">{profile?.full_name}</span>
            {profile?.role === 'tutor' && (
              <a href="/profile" className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors">
                Profil
              </a>
            )}
            <a href="/settings" className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors">
              Ustawienia
            </a>
            <form action={logout}>
              <button
                type="submit"
                className="cursor-pointer text-sm text-zinc-500 hover:text-zinc-900 transition-colors"
              >
                Wyloguj
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  )
}
