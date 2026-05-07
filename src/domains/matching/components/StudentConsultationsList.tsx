import type { MatchingRequestWithSubject } from '../types'

function formatDate(isoStr: string): string {
  return new Intl.DateTimeFormat('pl-PL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(isoStr))
}

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
          <div
            key={c.id}
            className="rounded-xl border border-zinc-200 bg-white px-4 py-3"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-zinc-900">
                  {c.subjects?.label ?? c.subject_id}
                </span>
                {c.level && (
                  <span className="text-xs text-zinc-500">{c.level}</span>
                )}
                {c.tutor_profile?.full_name && c.tutor_id && (
                  <a
                    href={`/tutor/${c.tutor_id}`}
                    className="text-xs text-zinc-400 hover:text-zinc-700 transition-colors"
                  >
                    Korepetytor: {c.tutor_profile.full_name}
                  </a>
                )}
              </div>
              <span className="shrink-0 pt-0.5 text-xs text-zinc-400">
                {formatDate(c.updated_at)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
