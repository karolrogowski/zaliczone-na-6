import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getCurrentProfile } from '@/domains/auth/queries'
import { getSessionDetail } from '@/domains/matching/queries'
import { isUuid } from '@/shared/validation/uuid'

function formatDate(isoStr: string): string {
  return new Intl.DateTimeFormat('pl-PL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(isoStr))
}

export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ requestId: string }>
}) {
  const { requestId } = await params

  if (!isUuid(requestId)) redirect('/history')

  const [profile, request] = await Promise.all([
    getCurrentProfile(),
    getSessionDetail(requestId),
  ])

  if (!request) redirect('/history')

  const isStudent = profile?.role === 'student'
  const isTutor = profile?.role === 'tutor'

  const isParticipant =
    (isStudent && request.student_id === profile?.id) ||
    (isTutor && request.tutor_id === profile?.id)

  if (!isParticipant) redirect('/history')

  const notes = Array.isArray(request.session)
    ? request.session[0]?.notes
    : request.session?.notes

  const otherPersonLabel = isStudent
    ? request.tutor_profile?.full_name
      ? `Korepetytor: ${request.tutor_profile.full_name}`
      : null
    : request.student_profile?.full_name
      ? `Uczeń: ${request.student_profile.full_name}`
      : null

  return (
    <div className="mx-auto max-w-2xl flex flex-col gap-6">
      <Link
        href="/history"
        className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 transition-colors"
      >
        <span aria-hidden="true">←</span> Wróć do historii
      </Link>

      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-zinc-900">
          Sesja — {request.subjects?.label ?? request.subject_id}
        </h1>
        <p className="text-sm text-zinc-500">{formatDate(request.updated_at)}</p>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white px-5 py-4 flex flex-col gap-2">
        {otherPersonLabel && (
          <p className="text-sm text-zinc-700">{otherPersonLabel}</p>
        )}
        {request.level && (
          <p className="text-sm text-zinc-700">
            <span className="text-zinc-500">Poziom:</span> {request.level}
          </p>
        )}
        {request.scope && (
          <p className="text-sm text-zinc-700">
            <span className="text-zinc-500">Zakres:</span> {request.scope}
          </p>
        )}
      </div>

      <hr className="border-zinc-200" />

      {notes ? (
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">
            Notatki z sesji
          </h2>
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700 whitespace-pre-wrap">
            {notes}
          </div>
        </div>
      ) : (
        <p className="text-sm text-zinc-400">Więcej szczegółów wkrótce.</p>
      )}
    </div>
  )
}