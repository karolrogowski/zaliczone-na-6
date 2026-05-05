import { getCurrentProfile } from '@/domains/auth/queries'

export default async function DashboardPage() {
  const profile = await getCurrentProfile()

  return (
    <div>
      <h1 className="text-2xl font-bold text-zinc-900">
        Cześć, {profile?.full_name}!
      </h1>
      <p className="mt-2 text-zinc-500">
        Rola: {profile?.role === 'student' ? 'Uczeń' : 'Korepetytor'}
      </p>
      <div className="mt-8 rounded-2xl border border-zinc-200 bg-white p-6">
        <p className="text-sm text-zinc-500">
          Dashboard w budowie — tutaj pojawi się główny widok aplikacji.
        </p>
      </div>
    </div>
  )
}
