'use client'

import { useActionState } from 'react'
import { saveTutorProfile } from '../actions'
import type { Subject } from '@/domains/matching/types'
import type { TutorOwnProfile } from '../types'

export function TutorProfileForm({
  subjects,
  profile,
}: {
  subjects: Subject[]
  profile: TutorOwnProfile | null
}) {
  const [state, formAction, isPending] = useActionState(saveTutorProfile, undefined)

  const checkedIds = new Set(profile?.tutor_subjects.map((ts) => ts.subject_id) ?? [])
  const initialRate =
    profile?.hourly_rate_grosz != null
      ? (profile.hourly_rate_grosz / 100).toFixed(2).replace('.', ',')
      : ''

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <div>
        <h2 className="mb-1 text-lg font-semibold text-zinc-900">Profil korepetytora</h2>
        <p className="text-sm text-zinc-500">
          Wybierz przedmioty, których uczysz, i ustaw swoją stawkę godzinową.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <p className="text-sm font-medium text-zinc-700">Przedmioty</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {subjects.map((subject) => (
            <label
              key={subject.id}
              className="flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 hover:border-zinc-400 has-[:checked]:border-zinc-900 has-[:checked]:bg-zinc-50 transition-colors"
            >
              <input
                type="checkbox"
                name="subject_ids"
                value={subject.id}
                defaultChecked={checkedIds.has(subject.id)}
                className="accent-zinc-900"
              />
              {subject.label}
            </label>
          ))}
        </div>
        {state?.errors?.subjects && (
          <p className="text-sm text-red-600">{state.errors.subjects[0]}</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="hourly_rate_pln" className="text-sm font-medium text-zinc-700">
          Stawka godzinowa (PLN)
        </label>
        <div className="relative w-40">
          <input
            id="hourly_rate_pln"
            name="hourly_rate_pln"
            type="text"
            inputMode="decimal"
            placeholder="np. 80"
            defaultValue={initialRate}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-zinc-400">
            PLN/h
          </span>
        </div>
        {state?.errors?.hourly_rate && (
          <p className="text-sm text-red-600">{state.errors.hourly_rate[0]}</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="bio" className="text-sm font-medium text-zinc-700">
          O sobie <span className="font-normal text-zinc-400">(opcjonalnie)</span>
        </label>
        <textarea
          id="bio"
          name="bio"
          rows={3}
          placeholder="Kilka słów o sobie, doświadczeniu i metodzie pracy..."
          defaultValue={profile?.bio ?? ''}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 resize-none"
        />
      </div>

      {state?.message && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{state.message}</p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="cursor-pointer self-start rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 transition-colors"
      >
        {isPending ? 'Zapisywanie...' : 'Zapisz profil'}
      </button>
    </form>
  )
}
