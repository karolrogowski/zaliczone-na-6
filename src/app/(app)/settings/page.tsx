import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/domains/auth/queries'
import { SettingsForm } from '@/domains/auth/components/SettingsForm'
import { getStudentAvoidedTutors, getStudentFavoriteTutors } from '@/domains/matching/queries'
import { AvoidedTutorsList } from '@/domains/matching/components/AvoidedTutorsList'
import { FavoriteTutorsList } from '@/domains/matching/components/FavoriteTutorsList'
import { getOwnTutorStripeState } from '@/domains/payments/queries'
import { BankAccountSection } from '@/domains/payments/components/BankAccountSection'

export default async function SettingsPage() {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')

  const [avoidedTutors, favoriteTutors] = profile.role === 'student'
    ? await Promise.all([getStudentAvoidedTutors(), getStudentFavoriteTutors()])
    : [[], []]

  const stripeState = profile.role === 'tutor' ? await getOwnTutorStripeState() : null

  return (
    <div className="flex flex-col h-full">
      <div className="shrink-0 bg-white border-b border-[#e8e6de] px-[26px] py-4">
        <h1 className="text-[16px] font-medium text-[#2c2c2a]">Ustawienia</h1>
        <p className="text-[11px] text-[#888780] mt-[2px]">Zarządzaj swoimi danymi i hasłem.</p>
      </div>

      <div className="flex-1 overflow-auto p-[22px_26px]">
        <div className="mx-auto max-w-xl flex flex-col gap-4">
          <SettingsForm profile={profile} />

          {stripeState && <BankAccountSection stripeState={stripeState} />}

          {profile.role === 'student' && (
            <>
              <div className="bg-white border border-[#e8e6de] rounded-[12px] p-[18px_20px] flex flex-col gap-4">
                <div>
                  <h2 className="text-[14px] font-medium text-[#2c2c2a]">Ulubieni korepetytorzy</h2>
                  <p className="text-[12px] text-[#888780] mt-[3px] leading-[1.5]">
                    Ulubieni korepetytorzy są powiadamiani o Twoich zleceniach jako pierwsi.
                    Możesz usunąć korepetytora z ulubionych w dowolnym momencie.
                  </p>
                </div>
                <FavoriteTutorsList tutors={favoriteTutors} />
              </div>

              <div className="bg-white border border-[#e8e6de] rounded-[12px] p-[18px_20px] flex flex-col gap-4">
                <div>
                  <h2 className="text-[14px] font-medium text-[#2c2c2a]">Zablokowani korepetytorzy</h2>
                  <p className="text-[12px] text-[#888780] mt-[3px] leading-[1.5]">
                    Korepetytorzy na tej liście nie widzą Twoich zleceń.
                    Usuń blokadę, jeśli chcesz znów mieć możliwość dopasowania z daną osobą.
                  </p>
                </div>
                <AvoidedTutorsList tutors={avoidedTutors} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
