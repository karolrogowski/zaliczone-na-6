import type { MatchingRequestWithSubject } from '../types'

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  accepted:  { label: 'Zaakceptowane', className: 'bg-blue-100 text-blue-800' },
  completed: { label: 'Zakończone',    className: 'bg-green-100 text-green-800' },
}

export function TutorRequestHistory({
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
          const { label, className } = STATUS_LABELS[req.status] ?? { label: req.status, className: 'bg-zinc-100 text-zinc-500' }
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
