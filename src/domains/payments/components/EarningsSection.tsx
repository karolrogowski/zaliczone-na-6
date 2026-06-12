'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { requestPayout } from '../actions'
import type { TutorBalance, TutorEarningRow } from '../types'

function groszToZloty(grosz: number) {
  return (grosz / 100).toFixed(2)
}

/**
 * Sekcja "Zarobki" w ustawieniach korepetytora: saldo Stripe, przycisk
 * wypłaty na konto bankowe i historia zarobków z zakończonych sesji.
 */
export function EarningsSection({
  balance,
  earnings,
}: {
  balance: TutorBalance
  earnings: TutorEarningRow[]
}) {
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)
  const router = useRouter()

  function handlePayout() {
    setMessage(null)
    startTransition(async () => {
      const result = await requestPayout()
      if (result.success) {
        setMessage({
          kind: 'success',
          text: `✓ Wypłata ${groszToZloty(result.amountGrosz)} zł została zlecona. Środki dotrą na Twoje konto w ciągu kilku dni roboczych.`,
        })
        router.refresh()
      } else {
        setMessage({ kind: 'error', text: result.message })
      }
    })
  }

  return (
    <div className="bg-white border border-[#e8e6de] rounded-[12px] p-[18px_20px] flex flex-col gap-4">
      <div>
        <h2 className="text-[14px] font-medium text-[#2c2c2a]">Zarobki</h2>
        <p className="text-[12px] text-[#888780] mt-[3px] leading-[1.5]">
          Twój udział z każdej sesji trafia na saldo Stripe. Wypłać zgromadzone
          środki na konto bankowe kiedy chcesz.
        </p>
      </div>

      <div className="flex items-end justify-between gap-4">
        <div className="flex gap-8">
          <div>
            <p className="text-[11px] text-[#888780]">Dostępne</p>
            <p className="text-[20px] font-medium text-[#2c2c2a]" data-testid="available-balance">
              {groszToZloty(balance.availableGrosz)} zł
            </p>
          </div>
          <div>
            <p className="text-[11px] text-[#888780]">Oczekujące</p>
            <p className="text-[20px] font-medium text-[#888780]" data-testid="pending-balance">
              {groszToZloty(balance.pendingGrosz)} zł
            </p>
          </div>
        </div>
        <button
          onClick={handlePayout}
          disabled={isPending || balance.availableGrosz <= 0}
          className="cursor-pointer shrink-0 rounded-[9px] bg-[#185FA5] px-[18px] py-[9px] text-[13px] font-medium text-white hover:bg-[#0C447C] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isPending ? 'Zlecanie wypłaty...' : 'Wypłać na konto bankowe'}
        </button>
      </div>

      {message && (
        <p
          className={
            message.kind === 'success'
              ? 'rounded-[10px] border border-[#b8e0c5] bg-[#EAF3DE] px-4 py-3 text-[13px] font-medium text-[#27500A]'
              : 'text-sm text-red-600'
          }
        >
          {message.text}
        </p>
      )}

      <div>
        <h3 className="text-[12px] font-medium text-[#2c2c2a] mb-2">Ostatnie sesje</h3>
        {earnings.length === 0 ? (
          <p className="text-sm text-zinc-400">Brak zakończonych sesji z płatnością.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {earnings.map((row) => (
              <li
                key={row.id}
                className="flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-2 text-[12px]"
              >
                <span className="text-zinc-600">
                  {new Date(row.created_at).toLocaleDateString('pl-PL', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </span>
                <span className="flex items-center gap-2">
                  {row.transfer_pending && (
                    <span className="rounded-full bg-[#FBF3DC] border border-[#ecd9a8] px-2 py-[1px] text-[10px] text-[#6b5418]">
                      oczekuje na konto bankowe
                    </span>
                  )}
                  <span className="font-medium text-[#2c2c2a]">
                    +{groszToZloty(row.tutor_earning_grosz)} zł
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
