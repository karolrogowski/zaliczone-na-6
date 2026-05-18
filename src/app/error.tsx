'use client'

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-zinc-50 px-4 text-center">
      <p className="text-5xl font-bold text-zinc-200">500</p>
      <h1 className="text-xl font-semibold text-zinc-800">Coś poszło nie tak</h1>
      <p className="text-sm text-zinc-500">Wystąpił nieoczekiwany błąd. Spróbuj ponownie.</p>
      <button
        onClick={reset}
        className="mt-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 transition-colors"
      >
        Spróbuj ponownie
      </button>
    </div>
  )
}