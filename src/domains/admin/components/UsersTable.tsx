import type { AdminUser } from '../types'

const ROLE_LABEL: Record<string, string> = {
  student: 'Uczeń',
  tutor: 'Korepetytor',
  admin: 'Admin',
}

export function UsersTable({ users }: { users: AdminUser[] }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-zinc-200">
      <table className="w-full text-sm">
        <thead className="border-b border-zinc-200 bg-zinc-50">
          <tr>
            {['Imię i nazwisko', 'Email', 'Rola', 'Rejestracja', 'Email potwierdzony', 'Stawka / ocena'].map(
              (h) => (
                <th key={h} className="px-4 py-3 text-left font-medium text-zinc-600">
                  {h}
                </th>
              )
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 bg-white">
          {users.map((u) => (
            <tr key={u.id} className="hover:bg-zinc-50 transition-colors">
              <td className="px-4 py-3 font-medium">{u.full_name}</td>
              <td className="px-4 py-3 text-zinc-500">{u.email ?? '—'}</td>
              <td className="px-4 py-3">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    u.role === 'admin'
                      ? 'bg-purple-100 text-purple-700'
                      : u.role === 'tutor'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-zinc-100 text-zinc-700'
                  }`}
                >
                  {ROLE_LABEL[u.role] ?? u.role}
                </span>
              </td>
              <td className="px-4 py-3 text-zinc-500">
                {new Date(u.created_at).toLocaleDateString('pl-PL')}
              </td>
              <td className="px-4 py-3">
                {u.email_confirmed_at ? (
                  <span className="text-green-600">✓</span>
                ) : (
                  <span className="text-red-400">Niepotwierdzony</span>
                )}
              </td>
              <td className="px-4 py-3 text-zinc-500">
                {u.tutor_profiles
                  ? `${u.tutor_profiles.hourly_rate_grosz != null ? (u.tutor_profiles.hourly_rate_grosz / 100).toFixed(0) + ' zł/h' : 'brak stawki'} · ★ ${u.tutor_profiles.rating_avg?.toFixed(1) ?? '—'}`
                  : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
