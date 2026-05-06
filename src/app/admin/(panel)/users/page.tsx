import { getAdminUsers } from '@/domains/admin/queries'
import { UsersTable } from '@/domains/admin/components/UsersTable'

export default async function AdminUsersPage() {
  const users = await getAdminUsers()

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-zinc-900">Użytkownicy ({users.length})</h1>
      <UsersTable users={users} />
    </div>
  )
}
