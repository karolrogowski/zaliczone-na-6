import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/domains/auth/queries'
import { RequestForm } from '@/domains/matching/components/RequestForm'
import { StudentRequestStatus } from '@/domains/matching/components/StudentRequestStatus'
import { StudentRequestHistory } from '@/domains/matching/components/StudentRequestHistory'
import { TutorDashboard } from '@/domains/matching/components/TutorDashboard'
import {
  getStudentActiveRequest,
  getStudentRecentRequests,
  getSubjects,
  getTutorAcceptedRequest,
  getTutorPendingRequests,
  getTutorProfileDetails,
  getTutorRecentRequests,
} from '@/domains/matching/queries'

export default async function DashboardPage() {
  const profile = await getCurrentProfile()

  if (profile?.role === 'admin') redirect('/admin/dashboard')

  if (profile?.role === 'student') {
    const [activeRequest, subjects, recentRequests] = await Promise.all([
      getStudentActiveRequest(),
      getSubjects(),
      getStudentRecentRequests(),
    ])

    return (
      <div className="flex flex-col gap-8">
        {activeRequest ? (
          <StudentRequestStatus initialRequest={activeRequest} />
        ) : (
          <RequestForm subjects={subjects} />
        )}
        <StudentRequestHistory requests={recentRequests} />
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
