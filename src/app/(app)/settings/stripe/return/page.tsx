import Link from 'next/link'
import { redirect } from 'next/navigation'
import { syncConnectOnboardingStatus } from '@/domains/payments/actions'

/**
 * Strona powrotu z hostowanego onboardingu Stripe Connect Express.
 * Synchronizuje status konta i informuje korepetytora o wyniku.
 */
export default async function StripeReturnPage() {
  const state = await syncConnectOnboardingStatus()

  if (!state.connected) redirect('/settings')

  return (
    <div className="flex flex-col h-full">
      <div className="shrink-0 bg-white border-b border-[#e8e6de] px-[26px] py-4">
        <h1 className="text-[16px] font-medium text-[#2c2c2a]">Konto bankowe</h1>
        <p className="text-[11px] text-[#888780] mt-[2px]">Status połączenia ze Stripe.</p>
      </div>

      <div className="flex-1 overflow-auto p-[22px_26px]">
        <div className="mx-auto max-w-xl">
          {state.onboardingDone ? (
            <div className="bg-white border border-[#e8e6de] rounded-[12px] p-[18px_20px] flex flex-col gap-4">
              <div className="rounded-[10px] border border-[#b8e0c5] bg-[#EAF3DE] px-4 py-3 text-[13px] font-medium text-[#27500A]">
                ✓ Konto bankowe zostało podłączone. Wypłaty za sesje będą trafiać na Twoje konto.
              </div>
              <Link
                href="/settings"
                className="self-start rounded-[9px] bg-[#185FA5] px-[18px] py-[9px] text-[13px] font-medium text-white hover:bg-[#0C447C] transition-colors"
              >
                Wróć do ustawień
              </Link>
            </div>
          ) : (
            <div className="bg-white border border-[#e8e6de] rounded-[12px] p-[18px_20px] flex flex-col gap-4">
              <div className="rounded-[10px] border border-[#ecd9a8] bg-[#FBF3DC] px-4 py-3 text-[13px] text-[#6b5418] leading-[1.5]">
                Stripe wymaga dodatkowych informacji, aby aktywować wypłaty.
                Dokończ konfigurację, aby otrzymywać pieniądze za sesje.
              </div>
              <div className="flex items-center gap-3">
                <Link
                  href="/settings/stripe/refresh"
                  className="rounded-[9px] bg-[#185FA5] px-[18px] py-[9px] text-[13px] font-medium text-white hover:bg-[#0C447C] transition-colors"
                >
                  Dokończ konfigurację
                </Link>
                <Link
                  href="/settings"
                  className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-medium text-zinc-600 hover:bg-zinc-100 transition-colors"
                >
                  Wróć do ustawień
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
