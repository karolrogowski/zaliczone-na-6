'use client'

import { useTransition } from 'react'
import { markSessionPaid } from '../actions'
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
            {['Data', 'Uczeń', 'Korepetytor', 'Przedmiot', 'Czas', 'Koszt ucznia', 'Zarobek korepetytora', 'Prowizja', 'Wypłata'].map(
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
  const fin = s.session_financials

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
    </tr>
  )
}
