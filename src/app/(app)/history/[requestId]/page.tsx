import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getCurrentProfile } from '@/domains/auth/queries'
import { getSessionDetail, getRatingsForSession, avgScore } from '@/domains/matching/queries'
import type { SessionRating } from '@/domains/matching/queries'
import { isUuid } from '@/shared/validation/uuid'

function formatDate(isoStr: string): string {
  return new Intl.DateTimeFormat('pl-PL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(isoStr))
}

function Stars({ score }: { score: number }) {
  const full = Math.floor(score)
  return (
    <span aria-label={`${score.toFixed(1)} z 5 gwiazdek`}>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className={i < full ? 'text-yellow-400' : i < score ? 'text-yellow-200' : 'text-zinc-200'}>★</span>
      ))}
    </span>
  )
}

function DimensionRow({ label, score }: { label: string; score: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-28 text-xs text-zinc-500">{label}</span>
      <Stars score={score} />
      <span className="text-xs text-zinc-600">{score}/5</span>
    </div>
  )
}

function StudentRatingCard({ rating, label }: { rating: SessionRating; label: string }) {
  const avg = avgScore(rating)
  return (
    <div className="rounded-xl border border-zinc-200 bg-white px-5 py-4 flex flex-col gap-3">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</p>
      {avg !== null && (
        <div className="flex items-center gap-2">
          <Stars score={avg} />
          <span className="text-sm font-medium text-zinc-700">⌀ {avg.toFixed(1)}/5</span>
        </div>
      )}
      <div className="flex flex-col gap-1">
        {rating.score_knowledge    != null && <DimensionRow label="Merytoryka"  score={rating.score_knowledge} />}
        {rating.score_organization != null && <DimensionRow label="Organizacja" score={rating.score_organization} />}
        {rating.score_communication != null && <DimensionRow label="Komunikacja" score={rating.score_communication} />}
      </div>
      {rating.comment && (
        <p className="text-sm text-zinc-600 italic">&ldquo;{rating.comment}&rdquo;</p>
      )}
    </div>
  )
}

function TutorRatingCard({ rating, label }: { rating: SessionRating; label: string }) {
  const isFlagged = rating.tutor_preference === 'flag'
  return (
    <div className="rounded-xl border border-zinc-200 bg-white px-5 py-4 flex flex-col gap-2">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</p>
      {isFlagged && (
        <p className="text-sm text-red-700">⚠️ Uczeń oznaczony jako problematyczny</p>
      )}
      {!isFlagged && !rating.comment && <p className="text-sm text-zinc-400">Brak uwag</p>}
      {rating.comment && (
        <p className="text-sm text-zinc-600 italic">&ldquo;{rating.comment}&rdquo;</p>
      )}
    </div>
  )
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

  const sessionId = Array.isArray(request.session)
    ? request.session[0]?.id
    : request.session?.id

  // Pobierz oceny — RLS automatycznie filtruje widoczność per rola
  const ratings = sessionId ? await getRatingsForSession(sessionId) : []

  const studentRating = ratings.find((r) => r.rated_by === 'student') ?? null
  const tutorRating   = ratings.find((r) => r.rated_by === 'tutor')   ?? null

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
        <p className="text-sm text-zinc-400">Brak notatek z sesji.</p>
      )}

      {/* Sekcja ocen */}
      {(studentRating || tutorRating) && (
        <>
          <hr className="border-zinc-200" />
          <div className="flex flex-col gap-3">
            <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500">Oceny</h2>

            {/* Uczeń widzi tylko swoją ocenę korepetytora */}
            {isStudent && studentRating && (
              <StudentRatingCard
                rating={studentRating}
                label={`Twoja ocena korepetytora${request.tutor_profile?.full_name ? ` (${request.tutor_profile.full_name})` : ''}`}
              />
            )}

            {/* Korepetytor widzi: ocenę ucznia o nim + swoją ocenę ucznia */}
            {isTutor && studentRating && (
              <StudentRatingCard
                rating={studentRating}
                label={`Ocena wystawiona przez ucznia${request.student_profile?.full_name ? ` (${request.student_profile.full_name})` : ''}`}
              />
            )}
            {isTutor && tutorRating && (
              <TutorRatingCard
                rating={tutorRating}
                label={`Twoja ocena ucznia${request.student_profile?.full_name ? ` (${request.student_profile.full_name})` : ''}`}
              />
            )}
          </div>
        </>
      )}

      {/* Brak ocen — tylko jeśli sesja ukończona */}
      {request.status === 'completed' && !studentRating && !tutorRating && (
        <>
          <hr className="border-zinc-200" />
          <p className="text-sm text-zinc-400">Brak ocen dla tej sesji.</p>
        </>
      )}
    </div>
  )
}
