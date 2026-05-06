import { getAdminSessions } from '@/domains/admin/queries'
import { SessionsTable } from '@/domains/admin/components/SessionsTable'

export default async function AdminSessionsPage() {
  const sessions = await getAdminSessions()

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-zinc-900">Sesje</h1>
      <SessionsTable sessions={sessions} />
    </div>
  )
}
