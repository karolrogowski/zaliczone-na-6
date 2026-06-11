'use client'

import { useState, useTransition } from 'react'
import { markSessionPaid, refundSession } from '../actions'
import type { AdminSession } from '../types'

function groszToZloty(grosz: number) {
  return (grosz / 100).toFixed(2)
}

export function SessionsTable({ sessions }: { sessions: AdminSession[] }) {
  if (sessions.length === 0) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-400">
        Brak sesji. Pojawią się tu po pierwszych zakończonych korepetycjach.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-zinc-200">
      <table className="w-full text-sm">
        <thead className="border-b border-zinc-200 bg-zinc-50">
          <tr>
            {['Data', 'Uczeń', 'Korepetytor', 'Przedmiot', 'Czas', 'Koszt ucznia', 'Zarobek korepetytora', 'Prowizja', 'Wypłata', 'Płatność'].map(
              (h) => (
                <th key={h} className="px-4 py-3 text-left font-medium text-zinc-600">
                  {h}
                </th>
              )
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 bg-white">
          {sessions.map((s) => (
            <SessionRow key={s.id} session={s} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function SessionRow({ session: s }: { session: AdminSession }) {
  const [isPending, startTransition] = useTransition()
  const [refundError, setRefundError] = useState<string | null>(null)
  const fin = s.session_financials
  const request = s.matching_requests

  function handleRefund() {
    if (!request) return
    setRefundError(null)
    startTransition(async () => {
      const result = await refundSession(request.id)
      if (!result.success) setRefundError(result.message)
    })
  }

  return (
    <tr className="hover:bg-zinc-50 transition-colors">
      <td className="px-4 py-3 text-zinc-500">
        {s.started_at ? new Date(s.started_at).toLocaleDateString('pl-PL') : '—'}
      </td>
      <td className="px-4 py-3 font-medium">{s.student?.full_name ?? '—'}</td>
      <td className="px-4 py-3">{s.tutor?.full_name ?? '—'}</td>
      <td className="px-4 py-3">{s.matching_requests?.subjects?.label ?? '—'}</td>
      <td className="px-4 py-3 text-zinc-500">
        {s.duration_minutes != null ? `${s.duration_minutes} min` : '—'}
      </td>
      <td className="px-4 py-3">{fin ? `${groszToZloty(fin.student_cost_grosz)} zł` : '—'}</td>
      <td className="px-4 py-3">{fin ? `${groszToZloty(fin.tutor_earning_grosz)} zł` : '—'}</td>
      <td className="px-4 py-3 text-zinc-500">
        {fin ? `${groszToZloty(fin.platform_commission_grosz)} zł` : '—'}
      </td>
      <td className="px-4 py-3">
        {!fin ? (
          <span className="text-zinc-400">—</span>
        ) : fin.paid_out_at ? (
          <span className="text-green-600 text-xs">
            Wypłacono {new Date(fin.paid_out_at).toLocaleDateString('pl-PL')}
          </span>
        ) : (
          <button
            onClick={() => startTransition(() => markSessionPaid(s.id))}
            disabled={isPending}
            className="cursor-pointer rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800 hover:bg-amber-200 disabled:opacity-50 transition-colors"
          >
            {isPending ? '...' : 'Oznacz jako wypłacone'}
          </button>
        )}
      </td>
      <td className="px-4 py-3">
        {request?.stripe_status === 'captured' ? (
          <div className="flex flex-col items-start gap-1">
            <button
              onClick={handleRefund}
              disabled={isPending}
              className="cursor-pointer rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50 transition-colors"
            >
              {isPending ? '...' : 'Zwróć płatność'}
            </button>
            {refundError && <span className="text-xs text-red-600">{refundError}</span>}
          </div>
        ) : request?.stripe_status === 'refunded' ? (
          <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-600">Zwrócono</span>
        ) : (
          <span className="text-zinc-400">—</span>
        )}
      </td>
    </tr>
  )
}
