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
      className="rounded-xl border border-zinc-200 bg-white px-4 py-3 flex items-center justify-between gap-4 hover:bg-zinc-50 transition-colors"
    >
      <div className="flex items-center justify-between gap-4 flex-1">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-medium text-zinc-900">
            {request.subjects?.label ?? request.subject_id}
          </span>
          {request.level && (
            <span className="text-xs text-zinc-500">{request.level}</span>
          )}
          {request.tutor_profile?.full_name && (
            <span className="text-xs text-zinc-400">
              Korepetytor: {request.tutor_profile.full_name}
            </span>
          )}
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className="text-xs text-zinc-400">{formatDate(request.updated_at)}</span>
          {showStatus && (
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusMeta.className}`}>
              {statusMeta.label}
            </span>
          )}
        </div>
      </div>
      <span className="shrink-0 text-zinc-400 text-sm" aria-hidden="true">→</span>
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
    <div className="mx-auto max-w-2xl flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-zinc-900">Historia sesji</h1>

      {sessions.length === 0 ? (
        <p className="text-sm text-zinc-500">Nie masz jeszcze żadnych zakończonych sesji.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {sessions.map((session) => (
            <SessionRow
              key={session.id}
              request={session}
              showStatus={isTutor}
            />
          ))}
        </div>
      )}
    </div>
  )
}