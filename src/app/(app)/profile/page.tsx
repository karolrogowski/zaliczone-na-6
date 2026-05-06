import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/domains/auth/queries'
import { getTutorOwnProfile } from '@/domains/auth/queries'
import { getSubjects } from '@/domains/matching/queries'
import { TutorProfileForm } from '@/domains/auth/components/TutorProfileForm'

export default async function ProfilePage() {
  const profile = await getCurrentProfile()

  if (!profile || profile.role !== 'tutor') redirect('/dashboard')

  const [subjects, tutorProfile] = await Promise.all([
    getSubjects(),
    getTutorOwnProfile(),
  ])

  return (
    <div className="mx-auto max-w-2xl">
      <TutorProfileForm subjects={subjects} profile={tutorProfile} />
    </div>
  )
}
