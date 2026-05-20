'use client'

import { useActionState, useState } from 'react'
import { verifyMfa } from '../actions'

export function MfaVerifyForm() {
  const [state, formAction, isPending] = useActionState(verifyMfa, undefined)
  const [code, setCode] = useState('')

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <div>
        <h2 className="mb-1 text-lg font-semibold text-zinc-900">Weryfikacja dwuetapowa</h2>
        <p className="text-sm text-zinc-500">
          Wpisz 6-cyfrowy kod z aplikacji Google Authenticator lub Authy.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="code" className="text-sm font-medium text-zinc-700">
          Kod weryfikacyjny
        </label>
        <input
          id="code"
          name="code"
          type="text"
          inputMode="numeric"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          placeholder="000000"
          autoFocus
          autoComplete="one-time-code"
          className="rounded-lg border border-zinc-300 px-3 py-2 text-center font-mono text-2xl tracking-widest focus:outline-none focus:ring-2 focus:ring-zinc-900"
        />
      </div>

      {state?.message && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{state.message}</p>
      )}

      <button
        type="submit"
        disabled={isPending || code.length !== 6}
        className="rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 transition-colors"
      >
        {isPending ? 'Weryfikowanie...' : 'Potwierdź'}
      </button>
    </form>
  )
}