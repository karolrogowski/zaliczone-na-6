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
import { getOwnTutorStripeState } from '@/domains/payments/queries'

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ ocena?: string; payment?: string }>
}) {
  const profile = await getCurrentProfile()

  if (profile?.role === 'admin') redirect('/admin/dashboard')

  const { ocena, payment } = await searchParams
  const ratingSuccess = ocena === 'zapisana' || ocena === 'zaktualizowana'
  const paymentSuccess = payment === 'success'

  if (profile?.role === 'student') {
    const [activeRequest, stats, consultations] = await Promise.all([
      getStudentActiveRequest(),
      getStudentStats(),
      getStudentRecentConsultations(),
    ])

    const tutorId = activeRequest?.status === 'accepted' ? activeRequest.tutor_id : null
    const previousTutorRating = tutorId ? await getStudentPreviousRatingOfTutor(tutorId) : null

    const firstName = profile.full_name?.split(' ')[0] ?? 'cześć'

    return (
      <div className="flex flex-col h-full">

        {/* Content header */}
        <div className="shrink-0 bg-white border-b border-[#e8e6de] px-[26px] py-4 flex items-center justify-between">
          <div>
            <h1 className="text-[16px] font-medium text-[#2c2c2a]">Dashboard</h1>
            <p className="text-[11px] text-[#888780] mt-[1px]">Twoja przestrzeń nauki</p>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto p-[22px_26px] flex flex-col gap-5">

          {ratingSuccess && (
            <div className="rounded-[10px] border border-[#b8e0c5] bg-[#EAF3DE] px-4 py-3 text-[13px] font-medium text-[#27500A]">
              ✓ Ocena została zapisana. Dziękujemy za feedback!
            </div>
          )}

          {paymentSuccess && (
            <div className="rounded-[10px] border border-[#b8e0c5] bg-[#EAF3DE] px-4 py-3 text-[13px] font-medium text-[#27500A]">
              ✓ Płatność zaakceptowana. Środki zostaną pobrane po zakończeniu sesji.
            </div>
          )}

          {/* Hero */}
          <div className="bg-white border border-[#e8e6de] rounded-[12px] p-5 flex items-center gap-6">
            <div className="flex-1 min-w-0">
              <h2 className="text-[18px] font-medium text-[#2c2c2a] mb-1">Cześć {firstName} 👋</h2>
              <p className="text-[13px] text-[#5f5e5a] leading-[1.6]">
                {stats.totalCompleted === 0
                  ? 'Witaj na platformie. Złóż pierwsze zlecenie kiedy będziesz potrzebować pomocy — szukamy korepetytora w kilka minut.'
                  : activeRequest
                  ? 'Masz aktywne zlecenie. Korepetytor niedługo dołączy do sesji.'
                  : 'Złóż nowe zlecenie gdy będziesz potrzebować pomocy — szukamy w kilka minut.'}
              </p>
            </div>
            {!activeRequest && (
              <a
                href="/request"
                className="shrink-0 flex items-center gap-2 px-[22px] py-[11px] bg-[#185FA5] text-white text-[13px] font-medium rounded-[9px] hover:bg-[#0C447C] transition-colors"
                style={{ boxShadow: '0 1px 0 rgba(12,68,124,0.3)' }}
              >
                <svg className="w-[14px] h-[14px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                Nowe zlecenie
              </a>
            )}
          </div>

          {activeRequest && (
            <StudentRequestStatus
              initialRequest={activeRequest}
              previousTutorRating={previousTutorRating}
            />
          )}

          {/* 2-col grid */}
          <div className="grid gap-4 items-start" style={{ gridTemplateColumns: '1.5fr 1fr' }}>
            <StudentConsultationsList consultations={consultations} />
            <StudentStatsSection stats={stats} />
          </div>

        </div>
      </div>
    )
  }

  if (profile?.role === 'tutor') {
    const [pendingRequests, tutorProfile, acceptedRequest, recentRequests, stripeState] = await Promise.all([
      getTutorPendingRequests(),
      getTutorProfileDetails(),
      getTutorAcceptedRequest(),
      getTutorRecentRequests(),
      getOwnTutorStripeState(),
    ])

    const studentIds = [...new Set(pendingRequests.map((r) => r.student_id).filter(Boolean))] as string[]
    const studentInteractions = await getTutorStudentInteractions(studentIds)

    return (
      <div className="flex-1 overflow-auto p-[22px_26px]">
        {ratingSuccess && (
          <div className="mb-5 rounded-[10px] border border-[#b8e0c5] bg-[#EAF3DE] px-4 py-3 text-[13px] font-medium text-[#27500A]">
            ✓ Ocena ucznia została zapisana. Dziękujemy!
          </div>
        )}
        {!stripeState.onboardingDone && (
          <div className="mb-5 rounded-[10px] border border-[#ecd9a8] bg-[#FBF3DC] px-4 py-3 text-[13px] text-[#6b5418]">
            Podłącz konto bankowe w{' '}
            <a href="/settings" className="font-medium underline hover:text-[#4a3a10]">
              Ustawieniach
            </a>
            , aby otrzymywać wypłaty za przeprowadzone sesje.
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
