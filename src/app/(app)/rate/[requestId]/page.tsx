import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/domains/auth/queries'
import { getSessionForRating, hasRatingForSession } from '@/domains/matching/queries'
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

  // Sprawdź, czy zalogowany użytkownik jest uczestnikiem tej sesji
  if (profile.role === 'student' && session.student_id !== profile.id) redirect('/dashboard')
  if (profile.role === 'tutor'   && session.tutor_id   !== profile.id) redirect('/dashboard')

  // Sprawdź, czy ta strona (rola) już wystawiła ocenę
  const alreadyRated = await hasRatingForSession(session.id, profile.role)
  if (alreadyRated) redirect('/dashboard')

  // Imię osoby ocenianej (kontekst w formularzu)
  const otherPersonName =
    profile.role === 'student'
      ? (session.tutor?.full_name   ?? undefined)
      : (session.student?.full_name ?? undefined)

  return (
    <div className="mx-auto max-w-lg">
      <RatingForm
        requestId={requestId}
        role={profile.role}
        otherPersonName={otherPersonName}
      />
    </div>
  )
}
