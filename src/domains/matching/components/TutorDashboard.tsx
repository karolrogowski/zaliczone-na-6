'use client'

import { useOptimistic, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { acceptMatchingRequest, completeMatchingRequest, toggleTutorAvailability } from '../actions'
import { useTutorRequests } from '../hooks/useTutorRequests'
import { useCountdown } from '../hooks/useCountdown'
import { TutorRequestHistory } from './TutorRequestHistory'
import { getSessionData } from '../sessionUtils'
import type { MatchingRequestWithSubject, TutorProfileDetails, TutorStudentInteraction } from '../types'

export function TutorDashboard({
  initialRequests,
  tutorProfile,
  acceptedRequest,
  recentRequests,
  studentInteractions,
}: {
  initialRequests: MatchingRequestWithSubject[]
  tutorProfile: TutorProfileDetails | null
  acceptedRequest: MatchingRequestWithSubject | null
  recentRequests: MatchingRequestWithSubject[]
  studentInteractions: Record<string, TutorStudentInteraction>
}) {
  const requests = useTutorRequests(initialRequests)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const [raceError, setRaceError] = useState<string | null>(null)
  const raceErrorTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function showRaceError(msg: string) {
    setRaceError(msg)
    if (raceErrorTimer.current) clearTimeout(raceErrorTimer.current)
    raceErrorTimer.current = setTimeout(() => setRaceError(null), 8000)
  }

  const [optimisticAvailable, setOptimisticAvailable] = useOptimistic(
    tutorProfile?.is_available ?? false
  )

  function handleToggle() {
    const next = !optimisticAvailable
    startTransition(async () => {
      setOptimisticAvailable(next)
      await toggleTutorAvailability(next)
    })
  }

  const profileIncomplete =
    !tutorProfile?.hourly_rate_grosz ||
    (tutorProfile.tutor_subjects?.length ?? 0) === 0 ||
    (tutorProfile.levels?.length ?? 0) === 0

  if (profileIncomplete) {
    return (
      <div className="bg-[#FAEEDA] border border-[#BA7517]/30 rounded-[12px] p-5 flex items-start gap-3">
        <div className="w-7 h-7 rounded-full bg-[#BA7517] text-white flex items-center justify-center shrink-0 mt-0.5">
          <svg className="w-[14px] h-[14px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
        </div>
        <div>
          <h2 className="text-[14px] font-medium text-[#633806] mb-1">Uzupełnij profil</h2>
          <p className="text-[13px] text-[#633806]/90 mb-4 leading-[1.5]">
            Ustaw swoją stawkę godzinową, przedmioty i poziomy, których uczysz.
          </p>
          <a
            href="/profile"
            className="inline-flex items-center gap-2 px-[18px] py-[9px] bg-[#BA7517] text-white text-[13px] font-medium rounded-[8px] hover:bg-[#9A6010] transition-colors"
          >
            Uzupełnij profil
          </a>
        </div>
      </div>
    )
  }

  if (acceptedRequest) {
    const sessionData = getSessionData(acceptedRequest.session)
    const sessionId = sessionData?.id
    const hasRoom = !!sessionData?.daily_room_url

    return (
      <div className="flex flex-col gap-5">
        <div className="bg-[#EAF3DE] border border-[#b8e0c5] rounded-[12px] p-5">
          <p className="text-[11px] font-medium uppercase tracking-wide text-[#27500A]/60 mb-2">Aktywna sesja</p>
          <h2 className="text-[15px] font-medium text-[#27500A] mb-1">Zaakceptowałeś zlecenie!</h2>
          <p className="text-[13px] text-[#3a6e1a]">
            Przedmiot:{' '}
            <span className="font-medium">{acceptedRequest.subjects?.label ?? acceptedRequest.subject_id}</span>
          </p>
          <div className="mt-4 flex items-center gap-4">
            {hasRoom && sessionId ? (
              <a
                href={`/session/${sessionId}`}
                data-testid="join-session-link"
                className="flex items-center gap-2 px-[22px] py-[11px] bg-[#185FA5] text-white text-[13px] font-medium rounded-[9px] hover:bg-[#0C447C] transition-colors"
                style={{ boxShadow: '0 1px 0 rgba(12,68,124,0.3)' }}
              >
                <svg className="w-[14px] h-[14px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="5 3 19 12 5 21 5 3"/>
                </svg>
                Dołącz do sesji
              </a>
            ) : (
              <p className="text-[13px] text-[#27500A]/70">Sesja wkrótce się rozpocznie...</p>
            )}
            <button
              onClick={() =>
                startTransition(async () => {
                  await completeMatchingRequest(acceptedRequest.id)
                  router.refresh()
                })
              }
              disabled={isPending}
              className="cursor-pointer text-[13px] text-[#888780] hover:text-[#2c2c2a] disabled:opacity-50 transition-colors"
            >
              {isPending ? 'Ładowanie...' : 'Zakończ sesję'}
            </button>
          </div>
        </div>
        <TutorRequestHistory requests={recentRequests} />
      </div>
    )
  }

  const ratingAvg = tutorProfile?.rating_avg ?? null
  const ratingCount = tutorProfile?.rating_count ?? 0

  return (
    <div className="flex flex-col gap-5">
      <div className="bg-white border border-[#e8e6de] rounded-[12px] p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[14px] font-medium text-[#2c2c2a]">Dostępność</h2>
            <p className="text-[13px] text-[#5f5e5a] mt-0.5">
              {optimisticAvailable
                ? 'Widzisz zlecenia i możesz je przyjmować'
                : 'Nie widzisz nowych zleceń'}
            </p>
          </div>
          <button
            onClick={handleToggle}
            disabled={isPending}
            role="switch"
            aria-checked={optimisticAvailable}
            data-testid="availability-toggle"
            className={`cursor-pointer relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${
              optimisticAvailable ? 'bg-[#27A259]' : 'bg-[#d3d1c7]'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                optimisticAvailable ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        <div className="border-t border-[#e8e6de] pt-4">
          <div className="mb-2 flex items-center gap-2">
            <p className="text-[11px] font-medium uppercase tracking-wide text-[#888780]">Twoja ocena</p>
            {ratingAvg !== null && ratingCount >= 5 && ratingAvg >= 4.5 && (
              <span className="rounded-full bg-[#FAEEDA] px-2 py-0.5 text-[11px] font-semibold text-[#BA7517]">
                VIP
              </span>
            )}
          </div>
          {ratingAvg !== null && ratingCount > 0 ? (
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex gap-0.5">
                {[1, 2, 3, 4, 5].map((i) => {
                  const full = Math.floor(ratingAvg)
                  const half = ratingAvg - full >= 0.5
                  return (
                    <span
                      key={i}
                      className={`text-lg leading-none ${
                        i <= full
                          ? 'text-yellow-400'
                          : i === full + 1 && half
                            ? 'text-yellow-200'
                            : 'text-[#d3d1c7]'
                      }`}
                    >
                      ★
                    </span>
                  )
                })}
              </div>
              <span className="text-[13px] font-semibold text-[#2c2c2a]">{ratingAvg.toFixed(1)}</span>
              <span className="text-[13px] text-[#888780]">
                ({ratingCount} {ratingCount === 1 ? 'ocena' : ratingCount < 5 ? 'oceny' : 'ocen'})
              </span>
              {ratingCount < 5 && (
                <span className="text-[12px] text-[#888780]">
                  — jeszcze {5 - ratingCount} {5 - ratingCount === 1 ? 'ocena' : 'ocen'} do VIP
                </span>
              )}
            </div>
          ) : (
            <p className="text-[13px] text-[#888780]">Brak ocen — pojawią się po pierwszej sesji.</p>
          )}
        </div>
      </div>

      {optimisticAvailable && (
        <div className="flex flex-col gap-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-[#888780]">
            Oczekujące zlecenia
          </p>

          {raceError && (
            <div className="rounded-[12px] border border-[#BA7517]/30 bg-[#FAEEDA] px-4 py-3 text-[13px] text-[#633806]">
              {raceError}
            </div>
          )}

          {requests.length === 0 ? (
            <div className="bg-white border border-[#e8e6de] rounded-[12px] p-6 text-center text-[13px] text-[#888780]">
              Brak zleceń w Twoich przedmiotach. Czekamy na uczniów...
            </div>
          ) : (
            requests.map((req) => (
              <RequestCard
                key={req.id}
                request={req}
                onRaceError={showRaceError}
                interaction={studentInteractions[req.student_id]}
              />
            ))
          )}
        </div>
      )}

      <TutorRequestHistory requests={recentRequests} />
    </div>
  )
}

function RequestCard({
  request,
  onRaceError,
  interaction,
}: {
  request: MatchingRequestWithSubject
  onRaceError: (msg: string) => void
  interaction?: TutorStudentInteraction
}) {
  const [isPending, startTransition] = useTransition()
  const secondsLeft = useCountdown(request.expires_at)
  const minutes = Math.floor(secondsLeft / 60)
  const seconds = secondsLeft % 60

  function handleAccept() {
    startTransition(async () => {
      const res = await acceptMatchingRequest(request.id)
      if (!res.success) {
        onRaceError(
          'Inny korepetytor był szybszy i przyjął to zlecenie — dlatego zniknęło z listy. Poczekaj na kolejne zgłoszenie.'
        )
      }
    })
  }

  return (
    <div className="bg-white border border-[#e8e6de] rounded-[12px] p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[14px] font-medium text-[#2c2c2a]">
            {request.subjects?.label ?? request.subject_id}
          </p>
          <div className="mt-1 flex flex-col gap-0.5">
            {request.level && <span className="text-[12px] text-[#5f5e5a]">{request.level}</span>}
            {request.description && (
              <span className="mt-0.5 text-[12px] text-[#888780]">{request.description}</span>
            )}
          </div>
        </div>
        <span className="shrink-0 rounded-full bg-[#f5f5f3] px-3 py-1 text-[13px] font-mono text-[#5f5e5a]">
          {/* suppressHydrationWarning — timer zmienia się co sekundę, wartość SSR i CSR celowo różna */}
          <span suppressHydrationWarning>{minutes}:{String(seconds).padStart(2, '0')}</span>
        </span>
      </div>

      {/* Odznaki poprzedniej interakcji z uczniem */}
      {interaction && (
        <div className="flex flex-wrap gap-1.5">
          {interaction.wantAgain && (
            <span className="rounded-full bg-[#EAF3DE] px-2.5 py-0.5 text-[11px] font-medium text-[#27500A]">
              Ulubiony korepetytor ucznia
            </span>
          )}
          {interaction.tutorFlagged && (
            <span className="rounded-full bg-[#FAEEDA] px-2.5 py-0.5 text-[11px] font-medium text-[#633806]">
              ⚠️ Oznaczono wcześniej
            </span>
          )}
          {interaction.hasPreviousSession && !interaction.wantAgain && !interaction.tutorFlagged && (
            <span className="rounded-full bg-[#f5f5f3] px-2.5 py-0.5 text-[11px] font-medium text-[#5f5e5a]">
              Uczyłeś już tego ucznia
            </span>
          )}
          {interaction.hasPreviousSession && interaction.studentLastScore !== null && (
            <span className="rounded-full bg-[#f5f5f3] px-2.5 py-0.5 text-[11px] font-medium text-[#5f5e5a]">
              Uczeń ocenił Cię: {interaction.studentLastScore}★
            </span>
          )}
          {interaction.tutorFlagged && interaction.tutorNote && (
            <span className="w-full rounded-[8px] bg-[#FAEEDA] border border-[#BA7517]/30 px-2.5 py-1.5 text-[12px] text-[#633806]">
              Twoja notatka: {interaction.tutorNote}
            </span>
          )}
        </div>
      )}

      <button
        onClick={handleAccept}
        disabled={isPending}
        className="cursor-pointer w-full rounded-[8px] bg-[#27A259] px-4 py-[9px] text-[13px] font-medium text-white hover:bg-[#1f8a4a] disabled:opacity-50 transition-colors"
      >
        {isPending ? 'Akceptowanie...' : 'Akceptuj zlecenie'}
      </button>
    </div>
  )
}
