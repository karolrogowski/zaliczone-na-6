import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/domains/auth/queries'
import { getSessionById, getSessionHostRoomUrl } from '@/domains/sessions/queries'
import { VideoSession } from '@/domains/sessions/components/VideoSession'
import { isUuid } from '@/shared/validation/uuid'

export default async function SessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>
}) {
  const { sessionId } = await params

  if (!isUuid(sessionId)) redirect('/dashboard')

  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')

  const session = await getSessionById(sessionId)

  if (!session) redirect('/dashboard')

  // Sprawdź czy użytkownik jest uczestnikiem sesji
  const isParticipant = session.student_id === profile.id || session.tutor_id === profile.id
  if (!isParticipant) redirect('/dashboard')

  // Jeśli sesja zakończona → przekieruj do oceny
  if (session.status === 'completed') {
    redirect(`/rate/${session.matching_request_id}`)
  }

  // Jeśli brak pokoju Daily.co → wróć do dashboardu
  if (!session.daily_room_url) redirect('/dashboard')

  const isTutor = session.tutor_id === profile.id
  const durationMinutes = session.duration_minutes ?? 60
  const hostRoomUrl = isTutor ? await getSessionHostRoomUrl(session.id) : null
  const roomUrl = isTutor
    ? (hostRoomUrl ?? session.daily_room_url)
    : session.daily_room_url

  return (
    <div className="flex flex-col h-full">
      <div className="shrink-0 bg-white border-b border-[#e8e6de] px-[26px] py-4 flex items-center justify-between">
        <h1 className="text-[15px] font-semibold text-[#2c2c2a]">Sesja wideo</h1>
        <a
          href="/dashboard"
          className="text-[13px] text-[#5f5e5a] hover:text-[#2c2c2a] transition-colors"
        >
          Wróć do dashboardu
        </a>
      </div>
      <div className="flex-1 overflow-auto p-[22px_26px]">
        <div className="mx-auto max-w-5xl">
          <VideoSession
            sessionId={session.id}
            matchingRequestId={session.matching_request_id}
            dailyRoomUrl={roomUrl}
            startedAt={session.started_at}
            durationMinutes={durationMinutes}
            isTutor={isTutor}
          />
        </div>
      </div>
    </div>
  )
}