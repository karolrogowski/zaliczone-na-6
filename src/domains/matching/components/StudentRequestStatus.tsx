'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { cancelMatchingRequest, completeMatchingRequest } from '../actions'
import { useStudentRequest } from '../hooks/useStudentRequest'
import { useCountdown } from '../hooks/useCountdown'
import { getSessionData } from '../sessionUtils'
import type { MatchingRequestWithSubject } from '../types'

export function StudentRequestStatus({
  initialRequest,
  previousTutorRating,
}: {
  initialRequest: MatchingRequestWithSubject
  previousTutorRating?: {
    score_knowledge: number | null
    score_organization: number | null
    score_communication: number | null
    preference: string | null
  } | null
}) {
  const request = useStudentRequest(initialRequest)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const secondsLeft = useCountdown(request?.expires_at ?? initialRequest.expires_at)
  const minutes = Math.floor(secondsLeft / 60)
  const seconds = secondsLeft % 60

  if (!request) return null

  const isExpired =
    request.status === 'pending' && new Date(request.expires_at) < new Date()

  function handleComplete() {
    startTransition(async () => {
      await completeMatchingRequest(request!.id)
      router.push(`/rate/${request!.id}`)
    })
  }

  function handleCancel() {
    startTransition(async () => {
      await cancelMatchingRequest(request!.id)
      router.refresh()
    })
  }

  if (request.status === 'completed' || request.status === 'cancelled') return null

  if (request.status === 'accepted') {
    const sessionData = getSessionData(request.session)
    const sessionId = sessionData?.id
    const hasRoom = !!sessionData?.daily_room_url

    return (
      <div className="rounded-2xl border border-green-200 bg-green-50 p-6">
        <div className="mb-2 text-2xl">🎉</div>
        <h2 className="mb-1 text-lg font-semibold text-zinc-900">Znaleziono korepetytora!</h2>
        <p className="text-sm text-zinc-600">
          {request.tutor_profile?.full_name && (
            <><strong>{request.tutor_profile.full_name}</strong> zaakceptował Twoje zlecenie z{' '}</>
          )}
          <strong>{request.subjects?.label ?? request.subject_id}</strong>.
        </p>

        {/* Poprzednia interakcja z tym korepetytorem */}
        {previousTutorRating && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="rounded-full bg-white/70 px-2.5 py-0.5 text-xs font-medium text-zinc-600">
              {(() => {
                const { score_knowledge: k, score_organization: o, score_communication: c } = previousTutorRating
                if (k == null || o == null || c == null) return null
                return `Poprzednia ocena: ⌀ ${(Math.round(((k + o + c) / 3) * 10) / 10).toFixed(1)}★`
              })()}
            </span>
            {previousTutorRating.preference === 'want_again' && (
              <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
                ⭐ Ulubiony korepetytor
              </span>
            )}
            {previousTutorRating.preference === 'avoid' && (
              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                ⚠️ Poprzednio oznaczono jako niepolecany
              </span>
            )}
          </div>
        )}

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
          onClick={handleComplete}
          disabled={isPending}
          className="cursor-pointer mt-4 block text-sm text-zinc-500 hover:text-zinc-700 disabled:opacity-50 transition-colors"
        >
          {isPending ? 'Ładowanie...' : 'Zakończ sesję'}
        </button>
      </div>
    )
  }

  if (isExpired) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-6">
        <h2 className="mb-1 text-lg font-semibold text-zinc-900">Zlecenie wygasło</h2>
        <p className="mb-4 text-sm text-zinc-500">
          Nie udało się znaleźć korepetytora w czasie.
        </p>
        <button
          onClick={handleCancel}
          disabled={isPending}
          className="cursor-pointer rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 transition-colors"
        >
          {isPending ? 'Ładowanie...' : 'Złóż nowe zlecenie'}
        </button>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
          <span className="text-sm font-medium text-zinc-700">Szukamy korepetytora...</span>
        </div>
        <span
          data-testid="countdown"
          suppressHydrationWarning
          className="rounded-full bg-zinc-100 px-3 py-1 text-sm font-mono text-zinc-600"
        >
          {minutes}:{String(seconds).padStart(2, '0')}
        </span>
      </div>
      <div className="mb-4 flex flex-col gap-1 text-sm text-zinc-600">
        <p>Przedmiot: <strong>{request.subjects?.label ?? request.subject_id}</strong></p>
        {request.level && <p>Poziom: <strong>{request.level}</strong></p>}
        {request.scope && <p>Zakres: <strong>{request.scope}</strong></p>}
        {request.description && <p className="text-zinc-500 mt-1">{request.description}</p>}
      </div>
      <button
        onClick={handleCancel}
        disabled={isPending}
        className="cursor-pointer text-sm text-red-500 hover:text-red-700 disabled:opacity-50 transition-colors"
      >
        {isPending ? 'Anulowanie...' : 'Anuluj zlecenie'}
      </button>
    </div>
  )
}
