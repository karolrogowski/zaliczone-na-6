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
} from '@/domains/matching/queries'

export default async function DashboardPage() {
  const profile = await getCurrentProfile()

  if (profile?.role === 'admin') redirect('/admin/dashboard')

  if (profile?.role === 'student') {
    const [activeRequest, stats, consultations] = await Promise.all([
      getStudentActiveRequest(),
      getStudentStats(),
      getStudentRecentConsultations(),
    ])

    return (
      <div className="mx-auto max-w-2xl flex flex-col gap-8">
        {activeRequest && <StudentRequestStatus initialRequest={activeRequest} />}
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

    return (
      <TutorDashboard
        initialRequests={pendingRequests}
        tutorProfile={tutorProfile}
        acceptedRequest={acceptedRequest}
        recentRequests={recentRequests}
      />
    )
  }

  return null
}
