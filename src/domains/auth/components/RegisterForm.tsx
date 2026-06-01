'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useActionState } from 'react'
import { register } from '../actions'

type Role = 'student' | 'tutor'
type Colors = { accent: string; bg: string; dark: string }

const S: Colors = { accent: '#185FA5', bg: '#E6F1FB', dark: '#0C447C' }
const T: Colors = { accent: '#0F6E56', bg: '#E1F5EE', dark: '#085041' }

const COPY: Record<Role, { headlineTop: string; headlineAccent: string; sub: string; cta: string }> = {
  student: {
    headlineTop: 'Klasówka jutro?',
    headlineAccent: 'Znajdź pomoc dziś wieczorem.',
    sub: 'Załóż konto bezpłatnie. Dane płatności uzupełnisz gdy będziesz gotowy.',
    cta: 'Załóż konto i szukaj korepetytora',
  },
  tutor: {
    headlineTop: 'Masz wiedzę?',
    headlineAccent: 'Zacznij zarabiać w ten weekend.',
    sub: 'Włączasz dostępność kiedy masz czas — zlecenia trafiają do Ciebie automatycznie.',
    cta: 'Załóż konto korepetytora',
  },
}

function pwdScore(v: string): number {
  if (v.length === 0) return 0
  const classes = [/[a-z]/.test(v), /[A-Z]/.test(v), /\d/.test(v), /[^A-Za-z0-9]/.test(v)].filter(Boolean).length
  if (v.length < 10 || classes < 3) return 1
  if (v.length >= 14 && classes === 4) return 3
  return 2
}

function pwdHint(v: string, score: number): string {
  if (score >= 2) return score === 3 ? 'Silne hasło' : 'Wystarczająco silne'
  if (v.length === 0) return 'Min. 10 znaków, 3 rodzaje znaków'
  const classes = [/[a-z]/.test(v), /[A-Z]/.test(v), /\d/.test(v), /[^A-Za-z0-9]/.test(v)].filter(Boolean).length
  if (v.length < 10) return `Za krótkie — minimum 10 znaków`
  if (classes < 3) return 'Dodaj wielką literę, cyfrę lub znak specjalny'
  return 'Za słabe'
}

const inputBase =
  'w-full px-[14px] py-3 border-[0.5px] border-[#d3d1c7] rounded-[10px] text-[14px] text-[#2c2c2a] bg-white outline-none placeholder:text-[#8a8980] transition-[border-color,box-shadow]'

export function RegisterForm() {
  const [state, action, pending] = useActionState(register, undefined)
  const [role, setRole] = useState<Role>('student')
  const [pwd, setPwd] = useState('')
  const [showPwd, setShowPwd] = useState(false)

  const c = role === 'tutor' ? T : S
  const score = pwdScore(pwd)
  const copy = COPY[role]

  const segColor = (i: number) => {
    if (i >= score) return '#e8e6de'
    return score === 1 ? '#D98C2B' : score === 2 ? '#EF9F27' : '#639922'
  }

  function focusOn(e: React.FocusEvent<HTMLInputElement>) {
    e.target.style.borderColor = c.accent
    e.target.style.boxShadow = `0 0 0 3px ${c.accent}24`
  }
  function focusOff(e: React.FocusEvent<HTMLInputElement>) {
    e.target.style.borderColor = '#d3d1c7'
    e.target.style.boxShadow = ''
  }

  return (
    <div className="min-h-screen w-full relative overflow-hidden" style={{ backgroundColor: '#f5f5f3', WebkitFontSmoothing: 'antialiased' }}>

      {/* Background brand "6" */}
      <div
        aria-hidden
        className="absolute pointer-events-none select-none font-bold leading-[0.8] tracking-[-0.04em] transition-colors duration-300"
        style={{ right: '-4vw', bottom: '-22vh', fontSize: '92vh', color: c.accent, opacity: 0.05, zIndex: 0 }}
      >
        6
      </div>

      {/* Top nav */}
      <nav className="relative z-10 flex items-center justify-between py-[22px] px-[clamp(20px,5vw,56px)]">
        <div className="flex items-center gap-[9px] text-[15px] font-medium text-[#2c2c2a]">
          <span
            className="w-6 h-6 rounded-[7px] flex items-center justify-center text-[13px] font-bold text-white transition-colors duration-300"
            style={{ backgroundColor: c.accent }}
          >6</span>
          Zaliczone na 6
        </div>
        <p className="text-[13px] text-[#5f5e5a]">
          Masz już konto?
          <Link href="/login" className="font-medium ml-[5px] hover:underline transition-colors duration-300" style={{ color: c.dark }}>
            Zaloguj się
          </Link>
        </p>
      </nav>

      {/* Main column */}
      <main className="relative z-10 flex flex-col items-center justify-center px-5 pb-14" style={{ minHeight: 'calc(100vh - 80px)' }}>
        <div className="w-full max-w-[452px]">

          {/* Live badge */}
          <div className="inline-flex items-center gap-2 px-[13px] py-[6px] bg-white border border-[#e8e6de] rounded-[22px] text-[12.5px] text-[#5f5e5a] mb-6 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
            <span className="relative w-2 h-2 flex-shrink-0">
              <span className="absolute inset-0 rounded-full bg-[#639922]" />
              <span className="absolute inset-0 rounded-full bg-[#639922] animate-ping opacity-75" />
            </span>
            <span>Korepetytorzy <strong className="text-[#2c2c2a] font-medium">online teraz</strong> · odpowiedź w kilka minut</span>
          </div>

          {/* Headline */}
          <h1
            className="font-medium leading-[1.12] tracking-[-0.02em] text-[#2c2c2a] mb-[14px]"
            style={{ fontSize: 'clamp(30px, 4.6vw, 42px)' }}
          >
            {copy.headlineTop}<br />
            <span className="transition-colors duration-300" style={{ color: c.dark }}>{copy.headlineAccent}</span>
          </h1>
          <p className="text-[15.5px] text-[#5f5e5a] leading-[1.6] mb-[30px]">{copy.sub}</p>

          <form action={action}>
            <input type="hidden" name="role" value={role} />

            {/* Role toggle */}
            <div className="grid grid-cols-2 gap-1 p-1 bg-white border border-[#e8e6de] rounded-[13px] mb-[22px]">
              {(['student', 'tutor'] as const).map(r => {
                const active = role === r
                const rc = r === 'tutor' ? T : S
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    className="flex items-center gap-[10px] px-3 py-[11px] rounded-[10px] text-left transition-colors duration-150 cursor-pointer"
                    style={active ? { backgroundColor: rc.bg } : {}}
                  >
                    <span
                      className="w-[30px] h-[30px] rounded-[8px] flex items-center justify-center flex-shrink-0 transition-colors duration-150"
                      style={active ? { backgroundColor: rc.accent, color: 'white' } : { backgroundColor: '#f0efeb', color: '#8a8980' }}
                    >
                      {r === 'student' ? <GradCapSvg /> : <BookSvg />}
                    </span>
                    <span className="leading-[1.25]">
                      <span className="block text-[13px] font-medium transition-colors duration-150" style={{ color: active ? rc.dark : '#5f5e5a' }}>
                        {r === 'student' ? 'Szukam korepetytora' : 'Chcę uczyć'}
                      </span>
                      <span className="block text-[11px] text-[#8a8980] mt-[1px]">
                        {r === 'student' ? 'Uczeń lub rodzic' : 'Zarabiaj elastycznie'}
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
            {state?.errors?.role && <p className="text-sm text-red-600 -mt-3 mb-3">{state.errors.role[0]}</p>}

            {/* Full name */}
            <div className="mb-[15px]">
              <label htmlFor="reg_name" className="block text-[12px] font-medium text-[#5f5e5a] mb-[6px]">Imię i nazwisko</label>
              <input
                id="reg_name" name="full_name" type="text" autoComplete="name" required
                placeholder="Anna Kowalska"
                className={inputBase}
                onFocus={focusOn} onBlur={focusOff}
              />
              {state?.errors?.full_name && <p className="text-sm text-red-600 mt-1">{state.errors.full_name[0]}</p>}
            </div>

            {/* Email */}
            <div className="mb-[15px]">
              <label htmlFor="reg_email" className="block text-[12px] font-medium text-[#5f5e5a] mb-[6px]">Email</label>
              <input
                id="reg_email" name="email" type="email" autoComplete="email" required
                placeholder="anna@example.com"
                className={inputBase}
                onFocus={focusOn} onBlur={focusOff}
              />
              {state?.errors?.email && <p className="text-sm text-red-600 mt-1">{state.errors.email[0]}</p>}
            </div>

            {/* Password */}
            <div className="mb-2">
              <label htmlFor="reg_pwd" className="block text-[12px] font-medium text-[#5f5e5a] mb-[6px]">Hasło</label>
              <div className="relative">
                <input
                  id="reg_pwd" name="password"
                  type={showPwd ? 'text' : 'password'}
                  autoComplete="new-password" required
                  placeholder="Min. 10 znaków"
                  value={pwd}
                  onChange={e => setPwd(e.target.value)}
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
              <div className="flex gap-[5px] mt-[9px]">
                {[0, 1, 2].map(i => (
                  <div key={i} className="flex-1 h-[3px] rounded-sm transition-colors duration-200" style={{ backgroundColor: segColor(i) }} />
                ))}
              </div>
              <p className={`text-[11.5px] mt-2 ${score >= 2 ? 'text-[#639922]' : 'text-[#8a8980]'}`}>
                {pwdHint(pwd, score)}
              </p>
              {state?.errors?.password && <p className="text-sm text-red-600 mt-1">{state.errors.password[0]}</p>}
            </div>

            {state?.message && (
              <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mt-2">{state.message}</p>
            )}

            <button
              type="submit"
              disabled={pending}
              className="w-full py-[14px] rounded-[11px] text-[15px] font-medium text-white flex items-center justify-center gap-[9px] mt-2 mb-[18px] transition-[filter] hover:brightness-90 disabled:opacity-50 cursor-pointer"
              style={{ backgroundColor: c.accent, boxShadow: `0 2px 8px ${c.accent}4d`, transition: 'filter 0.15s, background-color 0.3s' }}
            >
              {pending ? 'Rejestrowanie...' : copy.cta}
              {!pending && <ArrowSvg />}
            </button>

            <p className="text-[11.5px] text-[#8a8980] leading-[1.6] mt-[6px]">
              Tworząc konto akceptujesz{' '}
              <a href="#" className="text-[#5f5e5a] underline">Regulamin</a>
              {' '}i{' '}
              <a href="#" className="text-[#5f5e5a] underline">Politykę prywatności</a>.
            </p>
          </form>
        </div>
      </main>
    </div>
  )
}

function GradCapSvg() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 10v6M2 10l10-5 10 5-10 5z" /><path d="M6 12v5c3 3 9 3 12 0v-5" />
    </svg>
  )
}
function BookSvg() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
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
