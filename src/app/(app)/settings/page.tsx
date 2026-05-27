import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/domains/auth/queries'
import { SettingsForm } from '@/domains/auth/components/SettingsForm'
import { getStudentAvoidedTutors } from '@/domains/matching/queries'
import { AvoidedTutorsList } from '@/domains/matching/components/AvoidedTutorsList'

export default async function SettingsPage() {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')

  const avoidedTutors =
    profile.role === 'student' ? await getStudentAvoidedTutors() : []

  return (
    <div className="mx-auto max-w-xl flex flex-col gap-8">
      <SettingsForm profile={profile} />

      {profile.role === 'student' && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 flex flex-col gap-4">
          <div>
            <h2 className="font-semibold text-zinc-900">Zablokowani korepetytorzy</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Korepetytorzy na tej liście nie widzą Twoich zleceń.
              Usuń blokadę, jeśli chcesz znów mieć możliwość dopasowania z daną osobą.
            </p>
          </div>
          <AvoidedTutorsList tutors={avoidedTutors} />
        </div>
      )}
    </div>
  )
}
