'use client'

import { useActionState, useState } from 'react'
import { submitRating } from '../actions'

export function RatingForm({ requestId }: { requestId: string }) {
  const [state, formAction, isPending] = useActionState(submitRating, undefined)
  const [hovered, setHovered] = useState(0)
  const [selected, setSelected] = useState(0)

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <input type="hidden" name="request_id" value={requestId} />

      <div>
        <h2 className="mb-1 text-lg font-semibold text-zinc-900">Oceń korepetytora</h2>
        <p className="text-sm text-zinc-500">
          Twoja ocena pomaga innym uczniom wybrać najlepszego korepetytora.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-zinc-700">Ocena</p>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <label
              key={star}
              className="cursor-pointer"
              onMouseEnter={() => setHovered(star)}
              onMouseLeave={() => setHovered(0)}
            >
              <input
                type="radio"
                name="score"
                value={star}
                className="sr-only"
                onChange={() => setSelected(star)}
              />
              <span
                className={`text-4xl leading-none transition-colors select-none ${
                  star <= (hovered || selected) ? 'text-yellow-400' : 'text-zinc-200'
                }`}
              >
                ★
              </span>
            </label>
          ))}
        </div>
        {selected > 0 && (
          <p className="text-xs text-zinc-400">
            {['', 'Bardzo słabo', 'Słabo', 'Średnio', 'Dobrze', 'Doskonale'][selected]}
          </p>
        )}
        {state?.errors?.score && (
          <p className="text-sm text-red-600">{state.errors.score[0]}</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="comment" className="text-sm font-medium text-zinc-700">
          Komentarz <span className="font-normal text-zinc-400">(opcjonalnie)</span>
        </label>
        <textarea
          id="comment"
          name="comment"
          rows={3}
          placeholder="Co sądzisz o tej sesji?"
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900 resize-none"
        />
      </div>

      {state?.message && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{state.message}</p>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={isPending || selected === 0}
          className="cursor-pointer rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 transition-colors"
        >
          {isPending ? 'Zapisywanie...' : 'Wyślij ocenę'}
        </button>
        <a
          href="/dashboard"
          className="rounded-lg border border-zinc-200 px-5 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
        >
          Pomiń
        </a>
      </div>
    </form>
  )
}
