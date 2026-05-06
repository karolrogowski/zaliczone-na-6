'use client'

import { useActionState } from 'react'
import { adminLogin } from '../actions'

export function AdminLoginForm() {
  const [state, action, pending] = useActionState(adminLogin, undefined)

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
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="password" className="text-sm font-medium text-zinc-700">
          Hasło
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
        />
      </div>

      {state?.message && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{state.message}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 transition-colors"
      >
        {pending ? 'Logowanie...' : 'Zaloguj się'}
      </button>
    </form>
  )
}
