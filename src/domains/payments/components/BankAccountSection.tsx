'use client'

import { useState, useTransition } from 'react'
import { startConnectOnboarding, getExpressDashboardLink } from '../actions'
import type { TutorStripeState } from '../types'

/**
 * Sekcja "Konto bankowe" w ustawieniach korepetytora.
 * Przekierowuje na hostowany onboarding Stripe Connect Express,
 * a po jego ukończeniu daje dostęp do panelu wypłat Stripe.
 */
export function BankAccountSection({ stripeState }: { stripeState: TutorStripeState }) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleConnect() {
    setError(null)
    startTransition(async () => {
      const result = await startConnectOnboarding()
      if (result.success) {
        window.location.href = result.url
      } else {
        setError(result.message)
      }
    })
  }

  function handleOpenDashboard() {
    setError(null)
    startTransition(async () => {
      const result = await getExpressDashboardLink()
      if (result.success) {
        window.open(result.url, '_blank', 'noopener')
      } else {
        setError(result.message)
      }
    })
  }

  return (
    <div className="bg-white border border-[#e8e6de] rounded-[12px] p-[18px_20px] flex flex-col gap-4">
      <div>
        <h2 className="text-[14px] font-medium text-[#2c2c2a]">Konto bankowe</h2>
        <p className="text-[12px] text-[#888780] mt-[3px] leading-[1.5]">
          Wypłaty za sesje trafiają na Twoje konto bankowe przez Stripe.
          Konfiguracja i weryfikacja odbywa się bezpiecznie po stronie Stripe.
        </p>
      </div>

      {stripeState.onboardingDone ? (
        <div className="flex items-center justify-between gap-4">
          <span className="text-[13px] font-medium text-[#27500A]">✓ Konto podłączone</span>
          <button
            onClick={handleOpenDashboard}
            disabled={isPending}
            className="cursor-pointer shrink-0 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100 disabled:opacity-50 transition-colors"
          >
            {isPending ? 'Otwieranie...' : 'Otwórz panel wypłat Stripe'}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="rounded-[10px] border border-[#ecd9a8] bg-[#FBF3DC] px-4 py-3 text-[12px] text-[#6b5418] leading-[1.5]">
            Podłącz konto bankowe, aby otrzymywać wypłaty za przeprowadzone sesje.
          </div>
          <button
            onClick={handleConnect}
            disabled={isPending}
            className="cursor-pointer self-start rounded-[9px] bg-[#185FA5] px-[18px] py-[9px] text-[13px] font-medium text-white hover:bg-[#0C447C] disabled:opacity-50 transition-colors"
          >
            {isPending
              ? 'Łączenie ze Stripe...'
              : stripeState.hasAccount
              ? 'Dokończ konfigurację konta'
              : 'Połącz konto bankowe'}
          </button>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}
