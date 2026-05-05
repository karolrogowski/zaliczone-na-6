'use client'

import { useActionState } from 'react'
import { submitMatchingRequest } from '../actions'
import type { Subject } from '../types'

export function RequestForm({ subjects }: { subjects: Subject[] }) {
  const [state, action, pending] = useActionState(submitMatchingRequest, undefined)

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6">
      <h2 className="mb-1 text-lg font-semibold text-zinc-900">Zamów korepetytora</h2>
      <p className="mb-6 text-sm text-zinc-500">
        Dostępny korepetytor przyjmie zlecenie w ciągu kilku minut.
      </p>

      <form action={action} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="subject_id" className="text-sm font-medium text-zinc-700">
            Przedmiot
          </label>
          <select
            id="subject_id"
            name="subject_id"
            required
            defaultValue=""
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
          >
            <option value="" disabled>
              Wybierz przedmiot...
            </option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
          {state?.errors?.subject_id && (
            <p className="text-sm text-red-600">{state.errors.subject_id[0]}</p>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="description" className="text-sm font-medium text-zinc-700">
            Czego potrzebujesz? <span className="font-normal text-zinc-400">(opcjonalnie)</span>
          </label>
          <textarea
            id="description"
            name="description"
            rows={3}
            placeholder="np. Mam problem z równaniami kwadratowymi, jutro klasówka..."
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900 resize-none"
          />
        </div>

        {state?.message && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{state.message}</p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 transition-colors"
        >
          {pending ? 'Szukamy korepetytora...' : 'Znajdź korepetytora teraz'}
        </button>
      </form>
    </div>
  )
}
