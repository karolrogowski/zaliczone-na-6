import Link from 'next/link'
import { formatDate } from '@/shared/utils/formatDate'
import type { MatchingRequestWithSubject } from '../types'

export function StudentConsultationsList({
  consultations,
}: {
  consultations: MatchingRequestWithSubject[]
}) {
  if (consultations.length === 0) return null

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-medium uppercase tracking-wide text-zinc-500">
        Ostatnie konsultacje
      </h3>
      <div className="flex flex-col gap-2">
        {consultations.map((c) => (
          <Link
            key={c.id}
            href={`/history/${c.id}`}
            className="rounded-xl border border-zinc-200 bg-white px-4 py-3 flex items-center justify-between gap-4 hover:bg-zinc-50 transition-colors"
          >
            <div className="flex items-start justify-between gap-4 flex-1">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-zinc-900">
                  {c.subjects?.label ?? c.subject_id}
                </span>
                {c.level && (
                  <span className="text-xs text-zinc-500">{c.level}</span>
                )}
                {c.tutor_profile?.full_name && c.tutor_id && (
                  <span className="text-xs text-zinc-400">
                    Korepetytor: {c.tutor_profile.full_name}
                  </span>
                )}
              </div>
              <span className="shrink-0 pt-0.5 text-xs text-zinc-400">
                {formatDate(c.updated_at)}
              </span>
            </div>
            <span className="shrink-0 text-zinc-400 text-sm" aria-hidden="true">→</span>
          </Link>
        ))}
      </div>
      <Link
        href="/history"
        className="text-sm text-blue-600 hover:text-blue-700 transition-colors self-start"
      >
        Pokaż całą historię →
      </Link>
    </div>
  )
}