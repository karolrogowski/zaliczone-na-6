import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/domains/auth/queries'
import { getTutorPublicProfile } from '@/domains/matching/queries'
import { TutorPublicProfileView } from '@/domains/matching/components/TutorPublicProfileView'

export default async function TutorProfilePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const [profile, tutorProfile] = await Promise.all([
    getCurrentProfile(),
    getTutorPublicProfile(id),
  ])

  if (!profile) redirect('/login')
  if (!tutorProfile) redirect('/dashboard')

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-6">
        <a href="/dashboard" className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors">
          ← Powrót
        </a>
      </div>
      <TutorPublicProfileView profile={tutorProfile} />
    </div>
  )
}
