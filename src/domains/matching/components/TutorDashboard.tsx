'use client'

import { useEffect, useOptimistic, useState, useTransition } from 'react'
import { acceptMatchingRequest, toggleTutorAvailability } from '../actions'
import { useTutorRequests } from '../hooks/useTutorRequests'
import type { MatchingRequestWithSubject, TutorProfileDetails } from '../types'

function useMinutesLeft(expiresAt: string) {
  const calc = () =>
    Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 60000))
  const [minutes, setMinutes] = useState(calc)

  useEffect(() => {
    const id = setInterval(() => setMinutes(calc()), 60_000)
    return () => clearInterval(id)
  }, [expiresAt])

  return minutes
}

export function TutorDashboard({
  initialRequests,
  tutorProfile,
  acceptedRequest,
}: {
  initialRequests: MatchingRequestWithSubject[]
  tutorProfile: TutorProfileDetails | null
  acceptedRequest: MatchingRequestWithSubject | null
}) {
  const requests = useTutorRequests(initialRequests)
  const [isPending, startTransition] = useTransition()
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

  if (!tutorProfile?.hourly_rate_grosz) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
        <h2 className="mb-1 font-semibold text-zinc-900">Uzupełnij profil</h2>
        <p className="text-sm text-zinc-600">
          Zanim zaczniesz przyjmować zlecenia, ustaw swoją stawkę godzinową i przedmioty,
          których uczysz.
        </p>
      </div>
    )
  }

  if (acceptedRequest) {
    return (
      <div className="rounded-2xl border border-green-200 bg-green-50 p-6">
        <div className="mb-2 text-2xl">✅</div>
        <h2 className="mb-1 text-lg font-semibold text-zinc-900">Zaakceptowałeś zlecenie!</h2>
        <p className="text-sm text-zinc-600">
          Przedmiot:{' '}
          <strong>{acceptedRequest.subjects?.label ?? acceptedRequest.subject_id}</strong>.
          Sesja wkrótce się rozpocznie.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-2xl border border-zinc-200 bg-white p-6">
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
      </div>

      {optimisticAvailable && (
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-medium text-zinc-500 uppercase tracking-wide">
            Oczekujące zlecenia
          </h3>
          {requests.length === 0 ? (
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-center text-sm text-zinc-400">
              Brak zleceń w Twoich przedmiotach. Czekamy na uczniów...
            </div>
          ) : (
            requests.map((req) => <RequestCard key={req.id} request={req} />)
          )}
        </div>
      )}
    </div>
  )
}

function RequestCard({ request }: { request: MatchingRequestWithSubject }) {
  const [isPending, startTransition] = useTransition()
  const [errorMsg, setErrorMsg] = useOptimistic<string | null>(null)
  const minutesLeft = useMinutesLeft(request.expires_at)

  function handleAccept() {
    startTransition(async () => {
      const res = await acceptMatchingRequest(request.id)
      if (!res.success) setErrorMsg(res.message)
    })
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4">
      <div className="mb-3 flex items-start justify-between gap-4">
        <div>
          <p className="font-medium text-zinc-900">
            {request.subjects?.label ?? request.subject_id}
          </p>
          <div className="mt-1 flex flex-col gap-0.5 text-xs text-zinc-500">
            {request.level && <span>{request.level}</span>}
            {request.scope && <span>{request.scope}</span>}
            {request.description && <span className="mt-1 text-zinc-400">{request.description}</span>}
          </div>
        </div>
        <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500">
          {minutesLeft} min
        </span>
      </div>

      {errorMsg && <p className="mb-2 text-sm text-red-600">{errorMsg}</p>}

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
