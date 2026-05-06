'use client'

import { useEffect, useState, useTransition } from 'react'
import { cancelMatchingRequest } from '../actions'
import { useStudentRequest } from '../hooks/useStudentRequest'
import type { MatchingRequestWithSubject } from '../types'

function useCountdown(expiresAt: string) {
  const calc = () =>
    Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000))
  const [secs, setSecs] = useState(calc)

  useEffect(() => {
    const id = setInterval(() => setSecs(calc()), 1000)
    return () => clearInterval(id)
  }, [expiresAt])

  return secs
}

export function StudentRequestStatus({
  initialRequest,
}: {
  initialRequest: MatchingRequestWithSubject
}) {
  const request = useStudentRequest(initialRequest)
  const [isPending, startTransition] = useTransition()

  const secondsLeft = useCountdown(request?.expires_at ?? initialRequest.expires_at)
  const minutes = Math.floor(secondsLeft / 60)
  const seconds = secondsLeft % 60

  if (!request) return null

  const isExpired =
    request.status === 'pending' && new Date(request.expires_at) < new Date()

  if (request.status === 'accepted') {
    return (
      <div className="rounded-2xl border border-green-200 bg-green-50 p-6">
        <div className="mb-2 text-2xl">🎉</div>
        <h2 className="mb-1 text-lg font-semibold text-zinc-900">Znaleziono korepetytora!</h2>
        <p className="text-sm text-zinc-600">
          Korepetytor zaakceptował Twoje zlecenie z{' '}
          <strong>{request.subjects?.label ?? request.subject_id}</strong>.
          Sesja wkrótce się rozpocznie.
        </p>
      </div>
    )
  }

  if (isExpired) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-6">
        <h2 className="mb-1 text-lg font-semibold text-zinc-900">Zlecenie wygasło</h2>
        <p className="text-sm text-zinc-500">
          Nie udało się znaleźć korepetytora w czasie. Spróbuj ponownie.
        </p>
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
        onClick={() => startTransition(() => cancelMatchingRequest(request.id))}
        disabled={isPending}
        className="cursor-pointer text-sm text-red-500 hover:text-red-700 disabled:opacity-50 transition-colors"
      >
        {isPending ? 'Anulowanie...' : 'Anuluj zlecenie'}
      </button>
    </div>
  )
}
