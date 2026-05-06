import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/domains/auth/queries'
import { RequestForm } from '@/domains/matching/components/RequestForm'
import { StudentRequestStatus } from '@/domains/matching/components/StudentRequestStatus'
import { TutorDashboard } from '@/domains/matching/components/TutorDashboard'
import {
  getStudentActiveRequest,
  getSubjects,
  getTutorAcceptedRequest,
  getTutorPendingRequests,
  getTutorProfileDetails,
} from '@/domains/matching/queries'

export default async function DashboardPage() {
  const profile = await getCurrentProfile()

  if (profile?.role === 'admin') redirect('/admin/dashboard')

  if (profile?.role === 'student') {
    const [activeRequest, subjects] = await Promise.all([
      getStudentActiveRequest(),
      getSubjects(),
    ])

    return activeRequest ? (
      <StudentRequestStatus initialRequest={activeRequest} />
    ) : (
      <RequestForm subjects={subjects} />
    )
  }

  if (profile?.role === 'tutor') {
    const [pendingRequests, tutorProfile, acceptedRequest] = await Promise.all([
      getTutorPendingRequests(),
      getTutorProfileDetails(),
      getTutorAcceptedRequest(),
    ])

    return (
      <TutorDashboard
        initialRequests={pendingRequests}
        tutorProfile={tutorProfile}
        acceptedRequest={acceptedRequest}
      />
    )
  }

  return null
}
