'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { requestPasswordReset } from '../actions'

const ACCENT = '#185FA5'

const inputCls =
  'w-full px-[14px] py-3 border-[0.5px] border-[#d3d1c7] rounded-[10px] text-[14px] text-[#2c2c2a] bg-white outline-none placeholder:text-[#8a8980] transition-[border-color,box-shadow]'

function focusOn(e: React.FocusEvent<HTMLInputElement>) {
  e.target.style.borderColor = ACCENT
  e.target.style.boxShadow = `0 0 0 3px ${ACCENT}24`
}
function focusOff(e: React.FocusEvent<HTMLInputElement>) {
  e.target.style.borderColor = '#d3d1c7'
  e.target.style.boxShadow = ''
}

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(requestPasswordReset, undefined)

  if (state?.success) {
    return (
      <div className="flex flex-col gap-5">
        <div className="w-12 h-12 rounded-[14px] bg-[#E6F1FB] flex items-center justify-center">
          <svg className="w-6 h-6 text-[#185FA5]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
            <polyline points="22,6 12,13 2,6" />
          </svg>
        </div>
        <p className="text-[15.5px] text-[#5f5e5a] leading-[1.6]">
          Jeśli konto z tym adresem istnieje, wysłaliśmy link do resetowania hasła. Sprawdź skrzynkę mailową.
        </p>
        <Link href="/login" className="text-[14px] text-[#5f5e5a] hover:text-[#2c2c2a] transition-colors">
          ← Wróć do logowania
        </Link>
      </div>
    )
  }

  return (
    <form action={action} className="flex flex-col gap-[15px]">
      <div>
        <label htmlFor="fp_email" className="block text-[12px] font-medium text-[#5f5e5a] mb-[6px]">Email</label>
        <input
          id="fp_email" name="email" type="email" autoComplete="email" required
          placeholder="anna@example.com"
          className={inputCls}
          onFocus={focusOn} onBlur={focusOff}
        />
        {state?.errors?.email && <p className="text-sm text-red-600 mt-1">{state.errors.email[0]}</p>}
      </div>

      {state?.message && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{state.message}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full py-[14px] rounded-[11px] text-[15px] font-medium text-white flex items-center justify-center gap-[9px] mt-1 cursor-pointer transition-[filter] hover:brightness-90 disabled:opacity-50"
        style={{ backgroundColor: ACCENT, boxShadow: `0 2px 8px ${ACCENT}4d` }}
      >
        {pending ? 'Wysyłanie...' : 'Wyślij link do resetowania'}
      </button>

      <Link href="/login" className="text-center text-[14px] text-[#5f5e5a] hover:text-[#2c2c2a] transition-colors">
        ← Wróć do logowania
      </Link>
    </form>
  )
}
