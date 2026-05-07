import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/domains/auth/queries'
import { getStudentActiveRequest, getSubjects } from '@/domains/matching/queries'
import { RequestForm } from '@/domains/matching/components/RequestForm'

export default async function RequestPage() {
  const profile = await getCurrentProfile()
  if (!profile || profile.role !== 'student') redirect('/dashboard')

  const activeRequest = await getStudentActiveRequest()
  if (activeRequest) redirect('/dashboard')

  const subjects = await getSubjects()

  return (
    <div className="mx-auto max-w-2xl">
      <RequestForm subjects={subjects} />
    </div>
  )
}
