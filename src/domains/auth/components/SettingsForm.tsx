'use client'

import { useActionState } from 'react'
import { changePassword, updateFullName } from '../actions'
import type { Profile } from '../types'

const inputCls = 'w-full px-3 py-[10px] border-[0.5px] border-[#d3d1c7] rounded-[8px] text-[13px] text-[#2c2c2a] bg-white outline-none placeholder:text-[#8a8980] focus:border-[#185FA5] focus:ring-2 focus:ring-[#185FA5]/15 transition-shadow font-[inherit]'
const btnCls = 'cursor-pointer self-start px-[18px] py-[9px] bg-[#185FA5] text-white text-[13px] font-medium rounded-[8px] hover:bg-[#0C447C] disabled:opacity-50 transition-colors'

export function SettingsForm({ profile }: { profile: Profile }) {
  const [nameState, nameAction, namePending] = useActionState(updateFullName, undefined)
  const [pwdState, pwdAction, pwdPending] = useActionState(changePassword, undefined)

  return (
    <div className="flex flex-col gap-4">
      <form action={nameAction} className="bg-white border border-[#e8e6de] rounded-[12px] p-[18px_20px] flex flex-col gap-4">
        <h2 className="text-[14px] font-medium text-[#2c2c2a]">Dane osobowe</h2>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="full_name" className="text-[12px] font-medium text-[#5f5e5a]">
            Imię i nazwisko
          </label>
          <input
            id="full_name"
            name="full_name"
            type="text"
            defaultValue={profile.full_name}
            className={inputCls}
          />
          {nameState?.errors?.full_name && (
            <p className="text-[12px] text-red-600">{nameState.errors.full_name[0]}</p>
          )}
        </div>

        {nameState?.message && (
          <p className="text-[12px] text-red-600">{nameState.message}</p>
        )}
        {nameState?.success && (
          <p className="text-[12px] text-[#27500A]">Dane zostały zaktualizowane.</p>
        )}

        <button type="submit" disabled={namePending} className={btnCls}>
          {namePending ? 'Zapisywanie...' : 'Zapisz'}
        </button>
      </form>

      <form action={pwdAction} className="bg-white border border-[#e8e6de] rounded-[12px] p-[18px_20px] flex flex-col gap-4">
        <h2 className="text-[14px] font-medium text-[#2c2c2a]">Zmiana hasła</h2>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="password" className="text-[12px] font-medium text-[#5f5e5a]">
            Nowe hasło
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            className={inputCls}
          />
          {pwdState?.errors?.password && (
            <p className="text-[12px] text-red-600">{pwdState.errors.password[0]}</p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="confirmPassword" className="text-[12px] font-medium text-[#5f5e5a]">
            Potwierdź nowe hasło
          </label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            className={inputCls}
          />
          {pwdState?.errors?.confirmPassword && (
            <p className="text-[12px] text-red-600">{pwdState.errors.confirmPassword[0]}</p>
          )}
        </div>

        {pwdState?.message && (
          <p className="text-[12px] text-red-600">{pwdState.message}</p>
        )}
        {pwdState?.success && (
          <p className="text-[12px] text-[#27500A]">Hasło zostało zmienione.</p>
        )}

        <button type="submit" disabled={pwdPending} className={btnCls}>
          {pwdPending ? 'Zmienianie...' : 'Zmień hasło'}
        </button>
      </form>
    </div>
  )
}
