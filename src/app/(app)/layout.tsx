import { logout } from '@/domains/auth/actions'
import { getCurrentProfile } from '@/domains/auth/queries'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile()

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <span className="font-bold text-zinc-900">Zaliczone na 6</span>
          <div className="flex items-center gap-4">
            <span className="text-sm text-zinc-600">{profile?.full_name}</span>
            <form action={logout}>
              <button
                type="submit"
                className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors"
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
