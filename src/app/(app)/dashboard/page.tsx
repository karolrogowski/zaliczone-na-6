import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/domains/auth/queries'
import { StudentRequestStatus } from '@/domains/matching/components/StudentRequestStatus'
import { StudentStatsSection } from '@/domains/matching/components/StudentStatsSection'
import { StudentConsultationsList } from '@/domains/matching/components/StudentConsultationsList'
import { TutorDashboard } from '@/domains/matching/components/TutorDashboard'
import {
  getStudentActiveRequest,
  getStudentRecentConsultations,
  getStudentStats,
  getTutorAcceptedRequest,
  getTutorPendingRequests,
  getTutorProfileDetails,
  getTutorRecentRequests,
  getTutorStudentInteractions,
  getStudentPreviousRatingOfTutor,
} from '@/domains/matching/queries'

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ ocena?: string }>
}) {
  const profile = await getCurrentProfile()

  if (profile?.role === 'admin') redirect('/admin/dashboard')

  const { ocena } = await searchParams
  const ratingSuccess = ocena === 'zapisana'

  if (profile?.role === 'student') {
    const [activeRequest, stats, consultations] = await Promise.all([
      getStudentActiveRequest(),
      getStudentStats(),
      getStudentRecentConsultations(),
    ])

    // Pobierz poprzednią ocenę korepetytora tylko gdy zlecenie jest zaakceptowane
    const tutorId = activeRequest?.status === 'accepted' ? activeRequest.tutor_id : null
    const previousTutorRating = tutorId
      ? await getStudentPreviousRatingOfTutor(tutorId)
      : null

    return (
      <div className="mx-auto max-w-2xl flex flex-col gap-8">
        {ratingSuccess && (
          <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
            ✓ Ocena została zapisana. Dziękujemy za feedback!
          </div>
        )}
        {activeRequest && (
          <StudentRequestStatus
            initialRequest={activeRequest}
            previousTutorRating={previousTutorRating}
          />
        )}
        <StudentStatsSection stats={stats} hasActiveRequest={!!activeRequest} />
        <StudentConsultationsList consultations={consultations} />
      </div>
    )
  }

  if (profile?.role === 'tutor') {
    const [pendingRequests, tutorProfile, acceptedRequest, recentRequests] = await Promise.all([
      getTutorPendingRequests(),
      getTutorProfileDetails(),
      getTutorAcceptedRequest(),
      getTutorRecentRequests(),
    ])

    // Pobierz historię interakcji z uczniami z aktualnych zleceń
    const studentIds = [...new Set(pendingRequests.map((r) => r.student_id).filter(Boolean))] as string[]
    const studentInteractions = await getTutorStudentInteractions(studentIds)

    return (
      <div className="flex flex-col gap-6">
        {ratingSuccess && (
          <div className="mx-auto w-full max-w-2xl rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
            ✓ Ocena ucznia została zapisana. Dziękujemy!
          </div>
        )}
        <TutorDashboard
          initialRequests={pendingRequests}
          tutorProfile={tutorProfile}
          acceptedRequest={acceptedRequest}
          recentRequests={recentRequests}
          studentInteractions={studentInteractions}
        />
      </div>
    )
  }

  return null
}
