'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useActionState } from 'react'
import { login } from '../actions'

const ACCENT = '#185FA5'
const ACCENT_DARK = '#0C447C'

const inputBase =
  'w-full px-[14px] py-3 border-[0.5px] border-[#d3d1c7] rounded-[10px] text-[14px] text-[#2c2c2a] bg-white outline-none placeholder:text-[#8a8980] transition-[border-color,box-shadow]'

function focusOn(e: React.FocusEvent<HTMLInputElement>) {
  e.target.style.borderColor = ACCENT
  e.target.style.boxShadow = `0 0 0 3px ${ACCENT}24`
}
function focusOff(e: React.FocusEvent<HTMLInputElement>) {
  e.target.style.borderColor = '#d3d1c7'
  e.target.style.boxShadow = ''
}

export function LoginForm() {
  const [state, action, pending] = useActionState(login, undefined)
  const [showPwd, setShowPwd] = useState(false)

  return (
    <div className="min-h-screen w-full relative overflow-hidden" style={{ backgroundColor: '#f5f5f3', WebkitFontSmoothing: 'antialiased' }}>

      {/* Background brand "6" */}
      <div
        aria-hidden
        className="absolute pointer-events-none select-none font-bold leading-[0.8] tracking-[-0.04em]"
        style={{ right: '-4vw', bottom: '-22vh', fontSize: '92vh', color: ACCENT, opacity: 0.05, zIndex: 0 }}
      >
        6
      </div>

      {/* Top nav */}
      <nav className="relative z-10 flex items-center justify-between py-[22px] px-[clamp(20px,5vw,56px)]">
        <div className="flex items-center gap-[9px] text-[15px] font-medium text-[#2c2c2a]">
          <span className="w-6 h-6 rounded-[7px] flex items-center justify-center text-[13px] font-bold text-white" style={{ backgroundColor: ACCENT }}>
            6
          </span>
          Zaliczone na 6
        </div>
        <p className="text-[13px] text-[#5f5e5a]">
          Nie masz konta?
          <Link href="/register" className="font-medium ml-[5px] hover:underline" style={{ color: ACCENT_DARK }}>
            Zarejestruj się
          </Link>
        </p>
      </nav>

      {/* Main column */}
      <main className="relative z-10 flex flex-col items-center justify-center px-5 pb-14" style={{ minHeight: 'calc(100vh - 80px)' }}>
        <div className="w-full max-w-[452px]">

          <h1
            className="font-medium leading-[1.12] tracking-[-0.02em] text-[#2c2c2a] mb-[14px]"
            style={{ fontSize: 'clamp(30px, 4.6vw, 42px)' }}
          >
            Witaj z powrotem.<br />
            <span style={{ color: ACCENT_DARK }}>Wróć do nauki.</span>
          </h1>
          <p className="text-[15.5px] text-[#5f5e5a] leading-[1.6] mb-[30px]">
            Twoje zlecenia i historia sesji czekają na Ciebie.
          </p>

          <form action={action} className="flex flex-col gap-[15px]">

            <div>
              <label htmlFor="login_email" className="block text-[12px] font-medium text-[#5f5e5a] mb-[6px]">Email</label>
              <input
                id="login_email" name="email" type="email" autoComplete="email" required
                placeholder="anna@example.com"
                className={inputBase}
                onFocus={focusOn} onBlur={focusOff}
              />
              {state?.errors?.email && <p className="text-sm text-red-600 mt-1">{state.errors.email[0]}</p>}
            </div>

            <div>
              <div className="flex items-center justify-between mb-[6px]">
                <label htmlFor="login_pwd" className="text-[12px] font-medium text-[#5f5e5a]">Hasło</label>
                <Link href="/forgot-password" className="text-[12px] text-[#8a8980] hover:text-[#5f5e5a] transition-colors">
                  Zapomniałem hasła
                </Link>
              </div>
              <div className="relative">
                <input
                  id="login_pwd" name="password"
                  type={showPwd ? 'text' : 'password'}
                  autoComplete="current-password" required
                  placeholder="Twoje hasło"
                  className={`${inputBase} pr-[44px]`}
                  onFocus={focusOn} onBlur={focusOff}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(p => !p)}
                  className="absolute right-[6px] top-1/2 -translate-y-1/2 w-[34px] h-[34px] flex items-center justify-center rounded-[8px] text-[#8a8980] hover:text-[#5f5e5a] hover:bg-[#eeece7] transition-colors"
                  aria-label={showPwd ? 'Ukryj hasło' : 'Pokaż hasło'}
                >
                  {showPwd ? <EyeOffSvg /> : <EyeSvg />}
                </button>
              </div>
              {state?.errors?.password && <p className="text-sm text-red-600 mt-1">{state.errors.password[0]}</p>}
            </div>

            {state?.message && (
              <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{state.message}</p>
            )}

            <button
              type="submit"
              disabled={pending}
              className="w-full py-[14px] rounded-[11px] text-[15px] font-medium text-white flex items-center justify-center gap-[9px] mt-1 transition-[filter] hover:brightness-90 disabled:opacity-50 cursor-pointer"
              style={{ backgroundColor: ACCENT, boxShadow: `0 2px 8px ${ACCENT}4d` }}
            >
              {pending ? 'Logowanie...' : 'Zaloguj się'}
              {!pending && <ArrowSvg />}
            </button>
          </form>
        </div>
      </main>
    </div>
  )
}

function EyeSvg() {
  return (
    <svg className="w-[17px] h-[17px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
    </svg>
  )
}
function EyeOffSvg() {
  return (
    <svg className="w-[17px] h-[17px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  )
}
function ArrowSvg() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
    </svg>
  )
}
