import Link from 'next/link'
import { formatDate } from '@/shared/utils/formatDate'
import type { MatchingRequestWithSubject } from '../types'

function initials(name: string | null | undefined) {
  if (!name) return '?'
  return name.split(' ').filter(Boolean).slice(0, 2).map(n => n[0].toUpperCase()).join('')
}

export function StudentConsultationsList({
  consultations,
}: {
  consultations: MatchingRequestWithSubject[]
}) {
  return (
    <div className="bg-white border border-[#e8e6de] rounded-[12px] overflow-hidden">
      <div className="flex items-center justify-between px-4 pt-[14px] pb-[10px]">
        <h3 className="text-[13px] font-medium text-[#2c2c2a]">Ostatnie sesje</h3>
        <Link href="/history" className="text-[12px] text-[#185FA5] hover:underline">
          Cała historia →
        </Link>
      </div>

      {consultations.length === 0 ? (
        <div className="px-6 py-7 text-center">
          <div className="text-[28px] mb-2" style={{ opacity: 0.35 }}>📚</div>
          <p className="text-[13px] text-[#5f5e5a] leading-[1.7]">
            <strong className="text-[#2c2c2a] font-medium">Brak sesji</strong><br />
            Twoje sesje pojawią się tutaj po pierwszym zleceniu.
          </p>
        </div>
      ) : (
        <div>
          {consultations.map((c) => {
            const tutorName = c.tutor_profile?.full_name ?? null
            return (
              <Link
                key={c.id}
                href={`/history/${c.id}`}
                className="flex items-center gap-3 px-4 py-3 border-t border-[#e8e6de] hover:bg-[#fafaf8] transition-colors"
              >
                <div className="w-[34px] h-[34px] rounded-full flex items-center justify-center text-[12px] font-medium shrink-0 bg-[#E1F5EE] text-[#085041]">
                  {initials(tutorName)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-[#2c2c2a] truncate">
                    {tutorName ?? '—'}
                  </p>
                  <p className="text-[11px] text-[#888780] mt-[2px]">
                    {c.subjects?.label}
                    {c.level && (
                      <>
                        <span className="mx-[6px] text-[#d0cec5]">·</span>
                        {c.level}
                      </>
                    )}
                    <span className="mx-[6px] text-[#d0cec5]">·</span>
                    {formatDate(c.updated_at)}
                  </p>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
