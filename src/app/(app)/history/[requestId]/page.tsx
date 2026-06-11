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
      <span className="w-28 text-[11px] text-[#888780]">{label}</span>
      <Stars score={score} />
      <span className="text-[11px] text-[#5f5e5a]">{score}/5</span>
    </div>
  )
}

function StudentRatingCard({ rating, label }: { rating: SessionRating; label: string }) {
  const avg = avgScore(rating)
  return (
    <div className="bg-white border border-[#e8e6de] rounded-[12px] px-5 py-4 flex flex-col gap-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-[#888780]">{label}</p>
      {avg !== null && (
        <div className="flex items-center gap-2">
          <Stars score={avg} />
          <span className="text-[13px] font-medium text-[#5f5e5a]">⌀ {avg.toFixed(1)}/5</span>
        </div>
      )}
      <div className="flex flex-col gap-1">
        {rating.score_knowledge    != null && <DimensionRow label="Merytoryka"  score={rating.score_knowledge} />}
        {rating.score_organization != null && <DimensionRow label="Organizacja" score={rating.score_organization} />}
        {rating.score_communication != null && <DimensionRow label="Komunikacja" score={rating.score_communication} />}
      </div>
      {rating.comment && (
        <p className="text-[13px] text-[#5f5e5a] italic">&ldquo;{rating.comment}&rdquo;</p>
      )}
    </div>
  )
}

function TutorRatingCard({ rating, label }: { rating: SessionRating; label: string }) {
  const isFlagged = rating.tutor_preference === 'flag'
  return (
    <div className="bg-white border border-[#e8e6de] rounded-[12px] px-5 py-4 flex flex-col gap-2">
      <p className="text-[11px] font-medium uppercase tracking-wide text-[#888780]">{label}</p>
      {isFlagged && (
        <p className="text-[13px] text-red-700">⚠️ Uczeń oznaczony jako problematyczny</p>
      )}
      {!isFlagged && !rating.comment && <p className="text-[13px] text-[#888780]">Brak uwag</p>}
      {rating.comment && (
        <p className="text-[13px] text-[#5f5e5a] italic">&ldquo;{rating.comment}&rdquo;</p>
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

  const subjectLabel = request.subjects?.label ?? request.subject_id

  return (
    <div className="flex flex-col h-full">
      <div className="shrink-0 bg-white border-b border-[#e8e6de] px-[26px] py-4 flex items-center gap-4">
        <Link
          href="/history"
          className="text-[#888780] hover:text-[#2c2c2a] transition-colors"
          aria-label="Wróć do historii"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </Link>
        <div>
          <h1 className="text-[16px] font-medium text-[#2c2c2a]">Sesja — {subjectLabel}</h1>
          <p className="text-[11px] text-[#888780] mt-[1px]">{formatDate(request.updated_at)}</p>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-[22px_26px]">
        <div className="mx-auto max-w-2xl flex flex-col gap-4">

          {request.stripe_status === 'refunded' && (
            <div className="bg-zinc-50 border border-[#e8e6de] rounded-[12px] px-5 py-3 text-[13px] text-[#5f5e5a]">
              Płatność za tę sesję została zwrócona.
            </div>
          )}

          <div className="bg-white border border-[#e8e6de] rounded-[12px] px-5 py-4 flex flex-col gap-2">
            {otherPersonLabel && (
              <p className="text-[13px] text-[#2c2c2a]">{otherPersonLabel}</p>
            )}
            {request.level && (
              <p className="text-[13px] text-[#2c2c2a]">
                <span className="text-[#888780]">Poziom:</span> {request.level}
              </p>
            )}
            {request.scope && (
              <p className="text-[13px] text-[#2c2c2a]">
                <span className="text-[#888780]">Zakres:</span> {request.scope}
              </p>
            )}
          </div>

          {notes ? (
            <div className="flex flex-col gap-2">
              <h2 className="text-[11px] font-medium uppercase tracking-wide text-[#888780]">
                Notatki z sesji
              </h2>
              <div className="bg-white border border-[#e8e6de] rounded-[12px] p-4 text-[13px] text-[#2c2c2a] whitespace-pre-wrap">
                {notes}
              </div>
            </div>
          ) : (
            <p className="text-[13px] text-[#888780]">Brak notatek z sesji.</p>
          )}

          {(studentRating || tutorRating) && (
            <div className="flex flex-col gap-3">
              <h2 className="text-[11px] font-medium uppercase tracking-wide text-[#888780]">Oceny</h2>

              {isStudent && studentRating && (
                <StudentRatingCard
                  rating={studentRating}
                  label={`Twoja ocena korepetytora${request.tutor_profile?.full_name ? ` (${request.tutor_profile.full_name})` : ''}`}
                />
              )}

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
          )}

          {request.status === 'completed' && !studentRating && !tutorRating && (
            <p className="text-[13px] text-[#888780]">Brak ocen dla tej sesji.</p>
          )}
        </div>
      </div>
    </div>
  )
}
