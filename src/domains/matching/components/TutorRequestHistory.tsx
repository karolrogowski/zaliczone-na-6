import Link from 'next/link'
import { STATUS_LABELS, STATUS_LABEL_FALLBACK } from '../status'
import type { MatchingRequestWithSubject } from '../types'

export function TutorRequestHistory({
  requests,
}: {
  requests: MatchingRequestWithSubject[]
}) {
  if (requests.length === 0) return null

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-[#888780]">
        Ostatnie zlecenia
      </p>
      <div className="flex flex-col gap-2">
        {requests.map((req) => {
          const { label, className } = STATUS_LABELS[req.status] ?? { ...STATUS_LABEL_FALLBACK, label: req.status }
          return (
            <Link
              key={req.id}
              href={`/history/${req.id}`}
              className="bg-white border border-[#e8e6de] rounded-[12px] px-4 py-3 flex items-center justify-between gap-4 hover:border-[#d3d1c7] transition-colors"
            >
              <div className="flex items-center justify-between gap-4 flex-1">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[13px] font-medium text-[#2c2c2a]">
                    {req.subjects?.label ?? req.subject_id}
                  </span>
                  {req.level && (
                    <span className="text-[12px] text-[#888780]">{req.level}</span>
                  )}
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${className}`}>
                  {label}
                </span>
              </div>
              <span className="shrink-0 text-[#888780] text-[13px]" aria-hidden="true">→</span>
            </Link>
          )
        })}
      </div>
      <Link
        href="/history"
        className="text-[13px] text-[#185FA5] hover:text-[#0C447C] transition-colors self-start"
      >
        Pokaż całą historię →
      </Link>
    </div>
  )
}