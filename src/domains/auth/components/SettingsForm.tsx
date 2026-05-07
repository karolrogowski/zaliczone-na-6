'use client'

import { useActionState } from 'react'
import { changePassword, updateFullName } from '../actions'
import type { Profile } from '../types'

export function SettingsForm({ profile }: { profile: Profile }) {
  const [nameState, nameAction, namePending] = useActionState(updateFullName, undefined)
  const [pwdState, pwdAction, pwdPending] = useActionState(changePassword, undefined)

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-bold text-zinc-900">Ustawienia</h1>
        <p className="mt-1 text-sm text-zinc-500">Zarządzaj swoimi danymi i hasłem.</p>
      </div>

      {/* Zmiana imienia */}
      <form action={nameAction} className="rounded-2xl border border-zinc-200 bg-white p-6 flex flex-col gap-4">
        <h2 className="font-semibold text-zinc-900">Dane osobowe</h2>

        <div className="flex flex-col gap-2">
          <label htmlFor="full_name" className="text-sm font-medium text-zinc-700">
            Imię i nazwisko
          </label>
          <input
            id="full_name"
            name="full_name"
            type="text"
            defaultValue={profile.full_name}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
          />
          {nameState?.errors?.full_name && (
            <p className="text-sm text-red-600">{nameState.errors.full_name[0]}</p>
          )}
        </div>

        {nameState?.message && (
          <p className="text-sm text-red-600">{nameState.message}</p>
        )}
        {nameState?.success && (
          <p className="text-sm text-green-700">Dane zostały zaktualizowane.</p>
        )}

        <button
          type="submit"
          disabled={namePending}
          className="cursor-pointer self-start rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 transition-colors"
        >
          {namePending ? 'Zapisywanie...' : 'Zapisz'}
        </button>
      </form>

      {/* Zmiana hasła */}
      <form action={pwdAction} className="rounded-2xl border border-zinc-200 bg-white p-6 flex flex-col gap-4">
        <h2 className="font-semibold text-zinc-900">Zmiana hasła</h2>

        <div className="flex flex-col gap-2">
          <label htmlFor="password" className="text-sm font-medium text-zinc-700">
            Nowe hasło
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
          />
          {pwdState?.errors?.password && (
            <p className="text-sm text-red-600">{pwdState.errors.password[0]}</p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="confirmPassword" className="text-sm font-medium text-zinc-700">
            Potwierdź nowe hasło
          </label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
          />
          {pwdState?.errors?.confirmPassword && (
            <p className="text-sm text-red-600">{pwdState.errors.confirmPassword[0]}</p>
          )}
        </div>

        {pwdState?.message && (
          <p className="text-sm text-red-600">{pwdState.message}</p>
        )}
        {pwdState?.success && (
          <p className="text-sm text-green-700">Hasło zostało zmienione.</p>
        )}

        <button
          type="submit"
          disabled={pwdPending}
          className="cursor-pointer self-start rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 transition-colors"
        >
          {pwdPending ? 'Zmienianie...' : 'Zmień hasło'}
        </button>
      </form>
    </div>
  )
}
