'use client'

import { useTransition } from 'react'
import { cancelMatchingRequest } from '../actions'
import { useStudentRequest } from '../hooks/useStudentRequest'
import type { MatchingRequestWithSubject } from '../types'

export function StudentRequestStatus({
  initialRequest,
}: {
  initialRequest: MatchingRequestWithSubject
}) {
  const request = useStudentRequest(initialRequest)
  const [isPending, startTransition] = useTransition()

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
        <p className="mb-4 text-sm text-zinc-500">
          Nie udało się znaleźć korepetytora w czasie. Spróbuj ponownie.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6">
      <div className="mb-4 flex items-center gap-3">
        <div className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
        <span className="text-sm font-medium text-zinc-700">Szukamy korepetytora...</span>
      </div>
      <p className="mb-1 text-sm text-zinc-600">
        Przedmiot: <strong>{request.subjects?.label ?? request.subject_id}</strong>
      </p>
      {request.description && (
        <p className="mb-4 text-sm text-zinc-500">{request.description}</p>
      )}
      <button
        onClick={() =>
          startTransition(() => cancelMatchingRequest(request.id))
        }
        disabled={isPending}
        className="cursor-pointer text-sm text-red-500 hover:text-red-700 disabled:opacity-50 transition-colors"
      >
        {isPending ? 'Anulowanie...' : 'Anuluj zlecenie'}
      </button>
    </div>
  )
}
