import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getCurrentProfile } from '@/domains/auth/queries'
import { getStudentAllSessions, getTutorAllSessions } from '@/domains/matching/queries'
import { STATUS_LABELS, STATUS_LABEL_FALLBACK } from '@/domains/matching/status'
import { formatDate } from '@/shared/utils/formatDate'
import type { MatchingRequestWithSubject } from '@/domains/matching/types'

function SessionRow({
  request,
  showStatus,
}: {
  request: MatchingRequestWithSubject
  showStatus: boolean
}) {
  const statusMeta = STATUS_LABELS[request.status] ?? { ...STATUS_LABEL_FALLBACK, label: request.status }

  return (
    <Link
      href={`/history/${request.id}`}
      className="bg-white border border-[#e8e6de] rounded-[12px] px-4 py-3 flex items-center justify-between gap-4 hover:border-[#d3d1c7] transition-colors"
    >
      <div className="flex items-center justify-between gap-4 flex-1">
        <div className="flex flex-col gap-0.5">
          <span className="text-[13px] font-medium text-[#2c2c2a]">
            {request.subjects?.label ?? request.subject_id}
          </span>
          {request.level && (
            <span className="text-[12px] text-[#5f5e5a]">{request.level}</span>
          )}
          {request.tutor_profile?.full_name && (
            <span className="text-[12px] text-[#888780]">
              Korepetytor: {request.tutor_profile.full_name}
            </span>
          )}
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className="text-[11px] text-[#888780]">{formatDate(request.updated_at)}</span>
          {showStatus && (
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusMeta.className}`}>
              {statusMeta.label}
            </span>
          )}
        </div>
      </div>
      <span className="shrink-0 text-[#888780] text-sm" aria-hidden="true">→</span>
    </Link>
  )
}

export default async function HistoryPage() {
  const profile = await getCurrentProfile()

  if (!profile) redirect('/dashboard')

  const isStudent = profile.role === 'student'
  const isTutor = profile.role === 'tutor'

  if (!isStudent && !isTutor) redirect('/dashboard')

  const sessions = isStudent
    ? await getStudentAllSessions()
    : await getTutorAllSessions()

  return (
    <div className="flex flex-col h-full">
      <div className="shrink-0 bg-white border-b border-[#e8e6de] px-[26px] py-4">
        <h1 className="text-[16px] font-medium text-[#2c2c2a]">Historia sesji</h1>
        <p className="text-[11px] text-[#888780] mt-[2px]">Wszystkie Twoje zakończone korepetycje.</p>
      </div>

      <div className="flex-1 overflow-auto p-[22px_26px]">
        <div className="mx-auto max-w-2xl flex flex-col gap-2">
          {sessions.length === 0 ? (
            <p className="text-[13px] text-[#888780]">Nie masz jeszcze żadnych zakończonych sesji.</p>
          ) : (
            sessions.map((session) => (
              <SessionRow
                key={session.id}
                request={session}
                showStatus={isTutor}
              />
            ))
          )}
        </div>
      </div>
    </div>
  )
}
