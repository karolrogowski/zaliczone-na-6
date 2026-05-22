'use client'

import { useState, useActionState } from 'react'
import { submitMatchingRequest } from '../actions'
import { LEVEL_OPTIONS, SCOPE_OPTIONS } from '../options'
import type { Subject } from '../types'

const SELECT_CLASS =
  'rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900 bg-white'

const INPUT_CLASS =
  'rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900'

export function RequestForm({ subjects }: { subjects: Subject[] }) {
  const [state, action, pending] = useActionState(submitMatchingRequest, undefined)
  const [levelCode, setLevelCode] = useState('')
  const [scopeCode, setScopeCode] = useState('')

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6">
      <h2 className="mb-1 text-lg font-semibold text-zinc-900">Zamów korepetytora</h2>
      <p className="mb-6 text-sm text-zinc-500">
        Dostępny korepetytor przyjmie zlecenie w ciągu kilku minut.
      </p>

      <form action={action} className="flex flex-col gap-4">
        {/* Przedmiot */}
        <div className="flex flex-col gap-1">
          <label htmlFor="subject_id" className="text-sm font-medium text-zinc-700">
            Przedmiot
          </label>
          <select id="subject_id" name="subject_id" required defaultValue="" className={SELECT_CLASS}>
            <option value="" disabled>Wybierz przedmiot...</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
          {state?.errors?.subject_id && (
            <p className="text-sm text-red-600">{state.errors.subject_id[0]}</p>
          )}
        </div>

        {/* Poziom */}
        <div className="flex flex-col gap-1">
          <label htmlFor="level" className="text-sm font-medium text-zinc-700">
            Poziom nauczania
          </label>
          <select
            id="level"
            name="level"
            required
            value={levelCode}
            onChange={(e) => setLevelCode(e.target.value)}
            className={SELECT_CLASS}
          >
            <option value="" disabled>Wybierz poziom...</option>
            {LEVEL_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          {levelCode === 'inne' && (
            <input
              name="level_other"
              type="text"
              placeholder="Wpisz poziom..."
              required
              className={INPUT_CLASS}
            />
          )}
          {state?.errors?.level && (
            <p className="text-sm text-red-600">{state.errors.level[0]}</p>
          )}
        </div>

        {/* Zakres */}
        <div className="flex flex-col gap-1">
          <label htmlFor="scope" className="text-sm font-medium text-zinc-700">
            Zakres
          </label>
          <select
            id="scope"
            name="scope"
            required
            value={scopeCode}
            onChange={(e) => setScopeCode(e.target.value)}
            className={SELECT_CLASS}
          >
            <option value="" disabled>Wybierz zakres...</option>
            {SCOPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          {scopeCode === 'inne' && (
            <input
              name="scope_other"
              type="text"
              placeholder="Wpisz zakres..."
              required
              className={INPUT_CLASS}
            />
          )}
          {state?.errors?.scope && (
            <p className="text-sm text-red-600">{state.errors.scope[0]}</p>
          )}
        </div>

        {/* Opis — wymagany */}
        <div className="flex flex-col gap-1">
          <label htmlFor="description" className="text-sm font-medium text-zinc-700">
            Opisz zagadnienia
          </label>
          <textarea
            id="description"
            name="description"
            rows={3}
            required
            placeholder="np. Nie rozumiem równań kwadratowych, jutro klasówka z rozdziału 4..."
            className={`${INPUT_CLASS} resize-none`}
          />
          {state?.errors?.description && (
            <p className="text-sm text-red-600">{state.errors.description[0]}</p>
          )}
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
