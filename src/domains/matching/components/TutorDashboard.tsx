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
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
        <h2 className="mb-1 font-semibold text-zinc-900">Uzupełnij profil</h2>
        <p className="mb-4 text-sm text-zinc-600">
          Zanim zaczniesz przyjmować zlecenia, ustaw swoją stawkę godzinową, przedmioty
          i poziomy, których uczysz.
        </p>
        <a
          href="/profile"
          className="inline-block rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 transition-colors"
        >
          Uzupełnij profil
        </a>
      </div>
    )
  }

  if (acceptedRequest) {
    const sessionData = getSessionData(acceptedRequest.session)
    const sessionId = sessionData?.id
    const hasRoom = !!sessionData?.daily_room_url

    return (
      <div className="flex flex-col gap-6">
        <div className="rounded-2xl border border-green-200 bg-green-50 p-6">
          <div className="mb-2 text-2xl">✅</div>
          <h2 className="mb-1 text-lg font-semibold text-zinc-900">Zaakceptowałeś zlecenie!</h2>
          <p className="text-sm text-zinc-600">
            Przedmiot:{' '}
            <strong>{acceptedRequest.subjects?.label ?? acceptedRequest.subject_id}</strong>.
          </p>
          {hasRoom && sessionId ? (
            <a
              href={`/session/${sessionId}`}
              data-testid="join-session-link"
              className="mt-4 inline-block rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 transition-colors"
            >
              Dołącz do sesji
            </a>
          ) : (
            <p className="mt-3 text-sm text-zinc-400">Sesja wkrótce się rozpocznie...</p>
          )}
          <button
            onClick={() =>
              startTransition(async () => {
                await completeMatchingRequest(acceptedRequest.id)
                router.refresh()
              })
            }
            disabled={isPending}
            className="cursor-pointer mt-4 block text-sm text-zinc-500 hover:text-zinc-700 disabled:opacity-50 transition-colors"
          >
            {isPending ? 'Ładowanie...' : 'Zakończ sesję'}
          </button>
        </div>
        <TutorRequestHistory requests={recentRequests} />
      </div>
    )
  }

  const ratingAvg = tutorProfile?.rating_avg ?? null
  const ratingCount = tutorProfile?.rating_count ?? 0

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-zinc-900">Dostępność</h2>
            <p className="text-sm text-zinc-500">
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
              optimisticAvailable ? 'bg-green-500' : 'bg-zinc-300'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                optimisticAvailable ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        <div className="border-t border-zinc-100 pt-4">
          <div className="mb-1.5 flex items-center gap-2">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">Twoja ocena</p>
            {ratingAvg !== null && ratingCount >= 5 && ratingAvg >= 4.5 && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                ⭐ VIP
              </span>
            )}
          </div>
          {ratingAvg !== null && ratingCount > 0 ? (
            <div className="flex items-center gap-2">
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
                            : 'text-zinc-200'
                      }`}
                    >
                      ★
                    </span>
                  )
                })}
              </div>
              <span className="text-sm font-semibold text-zinc-700">{ratingAvg.toFixed(1)}</span>
              <span className="text-sm text-zinc-400">
                ({ratingCount} {ratingCount === 1 ? 'ocena' : ratingCount < 5 ? 'oceny' : 'ocen'})
              </span>
              {ratingCount < 5 && (
                <span className="text-xs text-zinc-400">
                  — jeszcze {5 - ratingCount} {5 - ratingCount === 1 ? 'ocena' : 'ocen'} do VIP
                </span>
              )}
            </div>
          ) : (
            <p className="text-sm text-zinc-400">Brak ocen — pojawią się po pierwszej sesji.</p>
          )}
        </div>
      </div>

      {optimisticAvailable && (
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-medium text-zinc-500 uppercase tracking-wide">
            Oczekujące zlecenia
          </h3>

          {raceError && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {raceError}
            </div>
          )}

          {requests.length === 0 ? (
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-center text-sm text-zinc-400">
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
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-medium text-zinc-900">
            {request.subjects?.label ?? request.subject_id}
          </p>
          <div className="mt-1 flex flex-col gap-0.5 text-xs text-zinc-500">
            {request.level && <span>{request.level}</span>}
            {request.scope && <span>{request.scope}</span>}
            {request.description && (
              <span className="mt-1 text-zinc-400">{request.description}</span>
            )}
          </div>
        </div>
        <span className="shrink-0 rounded-full bg-zinc-100 px-3 py-1 text-sm font-mono text-zinc-600">
          {/* suppressHydrationWarning — timer zmienia się co sekundę, wartość SSR i CSR celowo różna */}
          <span suppressHydrationWarning>{minutes}:{String(seconds).padStart(2, '0')}</span>
        </span>
      </div>

      {/* Odznaki poprzedniej interakcji z uczniem */}
      {interaction && (
        <div className="flex flex-wrap gap-1.5">
          {interaction.wantAgain && (
            <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
              ⭐ Uczeń preferuje Cię
            </span>
          )}
          {interaction.tutorFlagged && (
            <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">
              ⚠️ Oznaczono wcześniej
            </span>
          )}
          {interaction.hasPreviousSession && !interaction.wantAgain && !interaction.tutorFlagged && (
            <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-600">
              Uczyłeś już tego ucznia
            </span>
          )}
          {interaction.hasPreviousSession && interaction.studentLastScore !== null && (
            <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-600">
              Uczeń ocenił Cię: {interaction.studentLastScore}★
            </span>
          )}
          {interaction.tutorFlagged && interaction.tutorNote && (
            <span className="w-full rounded-lg bg-red-50 border border-red-100 px-2.5 py-1.5 text-xs text-red-700">
              Twoja notatka: {interaction.tutorNote}
            </span>
          )}
        </div>
      )}

      <button
        onClick={handleAccept}
        disabled={isPending}
        className="cursor-pointer w-full rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
      >
        {isPending ? 'Akceptowanie...' : 'Akceptuj zlecenie'}
      </button>
    </div>
  )
}
