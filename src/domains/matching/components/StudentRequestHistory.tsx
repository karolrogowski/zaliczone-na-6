import { STATUS_LABELS, STATUS_LABEL_FALLBACK } from '../status'
import type { MatchingRequestWithSubject } from '../types'

export function StudentRequestHistory({
  requests,
}: {
  requests: MatchingRequestWithSubject[]
}) {
  if (requests.length === 0) return null

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-medium uppercase tracking-wide text-zinc-500">
        Ostatnie zlecenia
      </h3>
      <div className="flex flex-col gap-2">
        {requests.map((req) => {
          const { label, className } = STATUS_LABELS[req.status] ?? { ...STATUS_LABEL_FALLBACK, label: req.status }
          return (
            <div
              key={req.id}
              className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-4 py-3"
            >
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-zinc-900">
                  {req.subjects?.label ?? req.subject_id}
                </span>
                {req.level && (
                  <span className="text-xs text-zinc-500">{req.level}</span>
                )}
                {req.status === 'accepted' || req.status === 'completed' ? (
                  req.tutor_profile?.full_name && (
                    <span className="text-xs text-zinc-400">
                      Korepetytor: {req.tutor_profile.full_name}
                    </span>
                  )
                ) : null}
              </div>
              <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`}>
                {label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
