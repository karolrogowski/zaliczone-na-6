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
  if (!profile || profile.role !== 'student') redirect('/dashboard')

  const session = await getSessionForRating(requestId)
  if (!session || session.status !== 'completed') redirect('/dashboard')

  const alreadyRated = await hasRatingForSession(session.id)
  if (alreadyRated) redirect('/dashboard')

  return (
    <div className="mx-auto max-w-lg">
      <RatingForm requestId={requestId} />
    </div>
  )
}
