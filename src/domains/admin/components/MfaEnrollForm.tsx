'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import QRCode from 'qrcode'
import { createClient } from '@/shared/supabase/client'

export function MfaEnrollForm() {
  const router = useRouter()
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [secret, setSecret] = useState<string | null>(null)
  const [factorId, setFactorId] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    async function enroll() {
      const supabase = createClient()

      // Jeśli użytkownik ma już zweryfikowany czynnik → powinien być na /verify, nie /enroll
      // (zabezpieczenie na wypadek bezpośredniego wejścia w URL)
      const { data: existing } = await supabase.auth.mfa.listFactors()
      if ((existing?.totp?.length ?? 0) > 0) {
        router.replace('/admin/mfa/verify')
        return
      }

      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        issuer: 'Zaliczone na 6',
      })
      if (error || !data) {
        setError(`Błąd: ${error?.message ?? 'nieznany błąd'}. Wyloguj się i zaloguj ponownie.`)
        return
      }

      // Generuj QR code jako PNG z TOTP URI — niezawodne w każdej przeglądarce
      const pngDataUrl = await QRCode.toDataURL(data.totp.uri, { width: 200, margin: 2 })

      setFactorId(data.id)
      setQrCode(pngDataUrl)
      setSecret(data.totp.secret)
    }
    enroll()
  }, [])

  function handleVerify() {
    if (!factorId || code.length !== 6) return
    startTransition(async () => {
      const supabase = createClient()
      const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code })
      if (error) {
        setError('Nieprawidłowy kod. Sprawdź aplikację i spróbuj ponownie.')
        return
      }
      router.push('/admin/dashboard')
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="mb-1 text-lg font-semibold text-zinc-900">
          Konfiguracja weryfikacji dwuetapowej
        </h2>
        <p className="text-sm text-zinc-500">
          Zeskanuj kod QR w Google Authenticator lub Authy, a następnie wpisz
          wygenerowany 6-cyfrowy kod.
        </p>
      </div>

      {qrCode ? (
        <div className="flex justify-center">
          <img src={qrCode} alt="Kod QR do Google Authenticator" width={200} height={200} />
        </div>
      ) : error ? null : (
        <div className="flex h-[200px] items-center justify-center text-sm text-zinc-400">
          Ładowanie kodu QR...
        </div>
      )}

      {secret && (
        <div className="rounded-lg bg-zinc-50 border border-zinc-200 p-3">
          <p className="mb-1 text-xs font-medium text-zinc-500">
            Klucz ręczny (jeśli nie możesz zeskanować):
          </p>
          <p className="font-mono text-sm text-zinc-900 break-all">{secret}</p>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <label htmlFor="code" className="text-sm font-medium text-zinc-700">
          Kod weryfikacyjny (6 cyfr)
        </label>
        <input
          id="code"
          type="text"
          inputMode="numeric"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          placeholder="000000"
          className="rounded-lg border border-zinc-300 px-3 py-2 text-center font-mono text-lg tracking-widest focus:outline-none focus:ring-2 focus:ring-zinc-900"
        />
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
      )}

      <button
        onClick={handleVerify}
        disabled={isPending || code.length !== 6 || !factorId}
        className="rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 transition-colors"
      >
        {isPending ? 'Weryfikowanie...' : 'Aktywuj weryfikację dwuetapową'}
      </button>
    </div>
  )
}
