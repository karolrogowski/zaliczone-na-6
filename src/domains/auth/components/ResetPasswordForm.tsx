'use client'

import { useActionState } from 'react'
import { updatePassword } from '../actions'

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

export function ResetPasswordForm() {
  const [state, action, pending] = useActionState(updatePassword, undefined)

  return (
    <form action={action} className="flex flex-col gap-[15px]">
      <div>
        <label htmlFor="rp_password" className="block text-[12px] font-medium text-[#5f5e5a] mb-[6px]">Nowe hasło</label>
        <input
          id="rp_password" name="password" type="password" autoComplete="new-password" required
          placeholder="Min. 10 znaków"
          className={inputCls}
          onFocus={focusOn} onBlur={focusOff}
        />
        {state?.errors?.password && <p className="text-sm text-red-600 mt-1">{state.errors.password[0]}</p>}
      </div>

      <div>
        <label htmlFor="rp_confirm" className="block text-[12px] font-medium text-[#5f5e5a] mb-[6px]">Powtórz nowe hasło</label>
        <input
          id="rp_confirm" name="confirmPassword" type="password" autoComplete="new-password" required
          placeholder="Powtórz hasło"
          className={inputCls}
          onFocus={focusOn} onBlur={focusOff}
        />
        {state?.errors?.confirmPassword && <p className="text-sm text-red-600 mt-1">{state.errors.confirmPassword[0]}</p>}
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
        {pending ? 'Zapisywanie...' : 'Ustaw nowe hasło'}
      </button>
    </form>
  )
}
