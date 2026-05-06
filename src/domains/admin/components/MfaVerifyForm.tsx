'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/shared/supabase/client'

export function MfaVerifyForm() {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleVerify() {
    if (code.length !== 6) return
    startTransition(async () => {
      const supabase = createClient()

      const { data: factors } = await supabase.auth.mfa.listFactors()
      const totp = factors?.totp?.[0]
      if (!totp) {
        setError('Brak zarejestrowanego czynnika MFA. Skontaktuj się z administratorem.')
        return
      }

      const { data: challenge, error: challengeErr } = await supabase.auth.mfa.challenge({
        factorId: totp.id,
      })
      if (challengeErr || !challenge) {
        setError('Błąd weryfikacji. Spróbuj ponownie.')
        return
      }

      const { error: verifyErr } = await supabase.auth.mfa.verify({
        factorId: totp.id,
        challengeId: challenge.id,
        code,
      })

      if (verifyErr) {
        setError('Nieprawidłowy kod. Sprawdź aplikację i spróbuj ponownie.')
        return
      }

      router.push('/admin/dashboard')
    })
  }

  return (
    <div className="flex flex-col gap-6">
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
          type="text"
          inputMode="numeric"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          placeholder="000000"
          autoFocus
          className="rounded-lg border border-zinc-300 px-3 py-2 text-center font-mono text-2xl tracking-widest focus:outline-none focus:ring-2 focus:ring-zinc-900"
        />
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
      )}

      <button
        onClick={handleVerify}
        disabled={isPending || code.length !== 6}
        className="rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 transition-colors"
      >
        {isPending ? 'Weryfikowanie...' : 'Potwierdź'}
      </button>
    </div>
  )
}
