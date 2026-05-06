import Link from 'next/link'
import { getAdminStats } from '@/domains/admin/queries'

function groszToZloty(grosz: number) {
  return (grosz / 100).toFixed(2)
}

export default async function AdminDashboardPage() {
  const stats = await getAdminStats()

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-zinc-900">Podsumowanie</h1>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <StatCard label="Sesje łącznie" value={stats.totalSessions.toString()} />
        <StatCard label="Użytkownicy" value={stats.totalUsers.toString()} />
        <StatCard
          label="Oczekujące wypłaty"
          value={`${groszToZloty(stats.pendingPayoutGrosze)} zł`}
          highlight={stats.pendingPayoutGrosze > 0}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        {[
          { href: '/admin/sessions', label: 'Zarządzaj sesjami →' },
          { href: '/admin/users', label: 'Zarządzaj użytkownikami →' },
          { href: '/admin/config', label: 'Konfiguracja platformy →' },
        ].map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="rounded-2xl border border-zinc-200 bg-white p-5 text-sm font-medium text-zinc-700 hover:border-zinc-400 transition-colors"
          >
            {link.label}
          </Link>
        ))}
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  highlight = false,
}: {
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <div
      className={`rounded-2xl border p-5 bg-white ${
        highlight ? 'border-amber-300' : 'border-zinc-200'
      }`}
    >
      <p className="text-sm text-zinc-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${highlight ? 'text-amber-600' : 'text-zinc-900'}`}>
        {value}
      </p>
    </div>
  )
}
