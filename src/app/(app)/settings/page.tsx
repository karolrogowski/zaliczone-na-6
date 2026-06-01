import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/domains/auth/queries'
import { SettingsForm } from '@/domains/auth/components/SettingsForm'
import { getStudentAvoidedTutors, getStudentFavoriteTutors } from '@/domains/matching/queries'
import { AvoidedTutorsList } from '@/domains/matching/components/AvoidedTutorsList'
import { FavoriteTutorsList } from '@/domains/matching/components/FavoriteTutorsList'

export default async function SettingsPage() {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')

  const [avoidedTutors, favoriteTutors] = profile.role === 'student'
    ? await Promise.all([getStudentAvoidedTutors(), getStudentFavoriteTutors()])
    : [[], []]

  return (
    <div className="mx-auto max-w-xl flex flex-col gap-8">
      <SettingsForm profile={profile} />

      {profile.role === 'student' && (
        <>
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 flex flex-col gap-4">
            <div>
              <h2 className="font-semibold text-zinc-900">Ulubieni korepetytorzy</h2>
              <p className="mt-1 text-sm text-zinc-500">
                Ulubieni korepetytorzy są powiadamiani o Twoich zleceniach jako pierwsi.
                Możesz usunąć korepetytora z ulubionych w dowolnym momencie.
              </p>
            </div>
            <FavoriteTutorsList tutors={favoriteTutors} />
          </div>

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
        </>
      )}
    </div>
  )
}
