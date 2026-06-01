import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/domains/auth/queries'
import { getSessionForRating, hasRatingForSession, getEditableRatingForSession } from '@/domains/matching/queries'
import { RatingForm } from '@/domains/matching/components/RatingForm'
import { isUuid } from '@/shared/validation/uuid'

export default async function RatingPage({
  params,
}: {
  params: Promise<{ requestId: string }>
}) {
  const { requestId } = await params

  if (!isUuid(requestId)) redirect('/dashboard')

  const profile = await getCurrentProfile()
  if (!profile || (profile.role !== 'student' && profile.role !== 'tutor')) {
    redirect('/dashboard')
  }

  const session = await getSessionForRating(requestId)
  if (!session || session.status !== 'completed') redirect('/dashboard')

  if (profile.role === 'student' && session.student_id !== profile.id) redirect('/dashboard')
  if (profile.role === 'tutor'   && session.tutor_id   !== profile.id) redirect('/dashboard')

  // Sprawdź ocenę: brak → nowa; istnieje + w oknie 15 min → edycja; po oknie → dashboard
  const alreadyRated = await hasRatingForSession(session.id, profile.role)
  if (alreadyRated) {
    // Tylko uczniowie mogą edytować w oknie 15 min (korepetytorzy nie mają editable_until)
    if (profile.role === 'tutor') redirect('/dashboard')

    const editableRating = await getEditableRatingForSession(session.id, profile.role)
    if (!editableRating) redirect('/dashboard')

    const otherPersonName = session.tutor?.full_name ?? undefined
    return (
      <div className="mx-auto max-w-lg flex flex-col gap-5">
        <RatingForm
          requestId={requestId}
          role={profile.role}
          otherPersonName={otherPersonName}
          existingRating={{
            score_knowledge:     editableRating.score_knowledge,
            score_organization:  editableRating.score_organization,
            score_communication: editableRating.score_communication,
            comment:             editableRating.comment,
            justification_category: editableRating.justification_category,
            preference:          editableRating.preference,
            editableUntil:       editableRating.editable_until,
          }}
        />
      </div>
    )
  }

  const otherPersonName =
    profile.role === 'student'
      ? (session.tutor?.full_name   ?? undefined)
      : (session.student?.full_name ?? undefined)

  return (
    <div className="mx-auto max-w-lg flex flex-col gap-5">
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <span className="font-semibold">Ocena jest wymagana przed przejściem dalej.</span>{' '}
        Platforma tymczasowo blokuje nawigację do innych stron — to celowe zachowanie, nie błąd.
        Wyślij ocenę, aby odblokować dostęp do platformy.
      </div>
      <RatingForm
        requestId={requestId}
        role={profile.role}
        otherPersonName={otherPersonName}
      />
    </div>
  )
}
