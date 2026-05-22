'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { requestPasswordReset } from '../actions'

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(requestPasswordReset, undefined)

  if (state?.success) {
    return (
      <div className="flex flex-col gap-4 text-center">
        <div className="text-4xl">📬</div>
        <p className="text-sm text-zinc-600">
          Jeśli konto z tym adresem istnieje, wysłaliśmy link do resetowania hasła.
          Sprawdź skrzynkę mailową.
        </p>
        <Link href="/login" className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors">
          Wróć do logowania
        </Link>
      </div>
    )
  }

  return (
    <form action={action} className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <label htmlFor="email" className="text-sm font-medium text-zinc-700">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900"
        />
        {state?.errors?.email && (
          <p className="text-sm text-red-600">{state.errors.email[0]}</p>
        )}
      </div>

      {state?.message && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{state.message}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 transition-colors"
      >
        {pending ? 'Wysyłanie...' : 'Wyślij link do resetowania'}
      </button>

      <Link href="/login" className="text-center text-sm text-zinc-500 hover:text-zinc-900 transition-colors">
        Wróć do logowania
      </Link>
    </form>
  )
}
