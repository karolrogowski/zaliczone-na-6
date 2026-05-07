import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/domains/auth/queries'
import { SettingsForm } from '@/domains/auth/components/SettingsForm'

export default async function SettingsPage() {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')

  return (
    <div className="mx-auto max-w-xl">
      <SettingsForm profile={profile} />
    </div>
  )
}
