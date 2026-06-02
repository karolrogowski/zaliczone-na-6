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
      <div className="bg-[#EAF3DE] border border-[#b8e0c5] rounded-[12px] p-5">
        <p className="text-[11px] font-medium uppercase tracking-wide text-[#27500A]/60 mb-2">Match</p>
        <h2 className="text-[15px] font-medium text-[#27500A] mb-1">Znaleziono korepetytora!</h2>
        <p className="text-[13px] text-[#3a6e1a]">
          {request.tutor_profile?.full_name && (
            <><span className="font-medium">{request.tutor_profile.full_name}</span> zaakceptował Twoje zlecenie —{' '}</>
          )}
          <span className="font-medium">{request.subjects?.label ?? request.subject_id}</span>
        </p>

        {previousTutorRating && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {(() => {
              const { score_knowledge: k, score_organization: o, score_communication: c } = previousTutorRating
              if (k == null || o == null || c == null) return null
              return (
                <span className="rounded-full bg-white/60 px-2.5 py-0.5 text-[11px] font-medium text-[#27500A]">
                  Poprzednia ocena: ⌀ {(Math.round(((k + o + c) / 3) * 10) / 10).toFixed(1)}★
                </span>
              )
            })()}
            {previousTutorRating.preference === 'want_again' && (
              <span className="rounded-full bg-white/60 px-2.5 py-0.5 text-[11px] font-medium text-[#27500A]">
                ⭐ Ulubiony korepetytor
              </span>
            )}
            {previousTutorRating.preference === 'avoid' && (
              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-medium text-amber-700">
                ⚠️ Poprzednio oznaczono jako niepolecany
              </span>
            )}
          </div>
        )}

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
            onClick={handleComplete}
            disabled={isPending}
            className="cursor-pointer text-[13px] text-[#888780] hover:text-[#2c2c2a] disabled:opacity-50 transition-colors"
          >
            {isPending ? 'Ładowanie...' : 'Zakończ sesję'}
          </button>
        </div>
      </div>
    )
  }

  if (isExpired) {
    return (
      <div className="bg-white border border-[#e8e6de] rounded-[12px] p-5">
        <h2 className="text-[15px] font-medium text-[#2c2c2a] mb-1">Zlecenie wygasło</h2>
        <p className="text-[13px] text-[#888780] mb-4">
          Nie udało się znaleźć korepetytora w czasie.
        </p>
        <button
          onClick={handleCancel}
          disabled={isPending}
          className="cursor-pointer flex items-center gap-2 px-[22px] py-[11px] bg-[#185FA5] text-white text-[13px] font-medium rounded-[9px] hover:bg-[#0C447C] disabled:opacity-50 transition-colors"
          style={{ boxShadow: '0 1px 0 rgba(12,68,124,0.3)' }}
        >
          {isPending ? 'Ładowanie...' : 'Złóż nowe zlecenie'}
        </button>
      </div>
    )
  }

  return (
    <div className="bg-white border border-[#e8e6de] rounded-[12px] p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 animate-pulse rounded-full bg-[#27A259]" />
          <span className="text-[13px] font-medium text-[#2c2c2a]">Szukamy korepetytora...</span>
        </div>
        <span
          data-testid="countdown"
          suppressHydrationWarning
          className="text-[13px] font-mono font-medium text-[#5f5e5a] bg-[#f5f5f3] rounded-[6px] px-2.5 py-1"
        >
          {minutes}:{String(seconds).padStart(2, '0')}
        </span>
      </div>
      <div className="flex flex-col gap-1 mb-4">
        <p className="text-[13px] text-[#2c2c2a]">
          <span className="text-[#888780]">Przedmiot:</span>{' '}
          <span className="font-medium">{request.subjects?.label ?? request.subject_id}</span>
        </p>
        {request.level && (
          <p className="text-[13px] text-[#2c2c2a]">
            <span className="text-[#888780]">Poziom:</span>{' '}
            <span className="font-medium">{request.level}</span>
          </p>
        )}
        {request.description && (
          <p className="text-[13px] text-[#5f5e5a] mt-0.5">{request.description}</p>
        )}
      </div>
      <button
        onClick={handleCancel}
        disabled={isPending}
        className="cursor-pointer text-[13px] text-red-500 hover:text-red-700 disabled:opacity-50 transition-colors"
      >
        {isPending ? 'Anulowanie...' : 'Anuluj zlecenie'}
      </button>
    </div>
  )
}
