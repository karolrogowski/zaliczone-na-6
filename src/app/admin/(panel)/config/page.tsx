import { getPlatformConfig, getAdminSubjects } from '@/domains/admin/queries'
import { ConfigForm } from '@/domains/admin/components/ConfigForm'

export default async function AdminConfigPage() {
  const [configs, subjects] = await Promise.all([getPlatformConfig(), getAdminSubjects()])

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-zinc-900">Konfiguracja</h1>
      <ConfigForm configs={configs} subjects={subjects} />
    </div>
  )
}
