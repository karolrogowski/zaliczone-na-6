'use client'

import { useActionState, useState } from 'react'
import { submitRating } from '../actions'
import { MIN_COMMENT_LOW_SCORE } from '../validation'

type RatingFormProps = {
  requestId: string
  role: 'student' | 'tutor'
  /** Imię/nazwisko osoby ocenianej, wyświetlane w nagłówku formularza */
  otherPersonName?: string
}

const STAR_LABELS = ['', 'Bardzo słabo', 'Słabo', 'Średnio', 'Dobrze', 'Doskonale']

export function RatingForm({ requestId, role, otherPersonName }: RatingFormProps) {
  const [state, formAction, isPending] = useActionState(submitRating, undefined)
  const [hovered,  setHovered]  = useState(0)
  const [selected, setSelected] = useState(0)
  const [comment,  setComment]  = useState('')
  const [preference, setPreference] = useState<'want_again' | 'avoid' | ''>('')

  const isStudent    = role === 'student'
  const needsComment = selected > 0 && selected <= 2
  const commentTooShort = needsComment && comment.length < MIN_COMMENT_LOW_SCORE
  const submitDisabled = isPending || selected === 0 || commentTooShort

  const heading = isStudent
    ? (otherPersonName ? `Oceń korepetytora ${otherPersonName}` : 'Oceń korepetytora')
    : (otherPersonName ? `Oceń ucznia ${otherPersonName}` : 'Oceń ucznia')

  const subheading = isStudent
    ? 'Twoja ocena pomaga innym uczniom wybrać najlepszego korepetytora.'
    : 'Twoja ocena pomaga nam dbać o jakość społeczności uczniów na platformie.'

  function togglePreference(value: 'want_again' | 'avoid') {
    setPreference(prev => prev === value ? '' : value)
  }

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <input type="hidden" name="request_id" value={requestId} />
      <input type="hidden" name="rated_by"   value={role} />
      <input type="hidden" name="preference" value={preference} />

      {/* Nagłówek */}
      <div>
        <h2 className="mb-1 text-lg font-semibold text-zinc-900">{heading}</h2>
        <p className="text-sm text-zinc-500">{subheading}</p>
      </div>

      {/* Gwiazdki */}
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
          <p className="text-xs text-zinc-400">{STAR_LABELS[selected]}</p>
        )}
        {state?.errors?.score && (
          <p className="text-sm text-red-600">{state.errors.score[0]}</p>
        )}
      </div>

      {/* Komentarz */}
      <div className="flex flex-col gap-2">
        <label htmlFor="comment" className="text-sm font-medium text-zinc-700">
          Komentarz{' '}
          {needsComment ? (
            <span className="font-normal text-red-600">(wymagany przy ocenie 1–2★)</span>
          ) : (
            <span className="font-normal text-zinc-400">(opcjonalnie)</span>
          )}
        </label>
        <textarea
          id="comment"
          name="comment"
          rows={3}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder={
            needsComment
              ? `Opisz powód niskiej oceny (min. ${MIN_COMMENT_LOW_SCORE} znaków)...`
              : 'Co sądzisz o tej sesji?'
          }
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900 resize-none"
        />
        {needsComment && (
          <p className={`text-xs ${commentTooShort ? 'text-red-500' : 'text-zinc-400'}`}>
            {comment.length} / {MIN_COMMENT_LOW_SCORE} znaków minimum
          </p>
        )}
        {state?.errors?.comment && (
          <p className="text-sm text-red-600">{state.errors.comment[0]}</p>
        )}
      </div>

      {/* Preferencje (tylko dla ucznia) */}
      {isStudent && (
        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium text-zinc-700">
            Preferencje <span className="font-normal text-zinc-400">(opcjonalnie)</span>
          </p>

          <label className="flex items-start gap-3 cursor-pointer group">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900 cursor-pointer"
              checked={preference === 'want_again'}
              onChange={() => togglePreference('want_again')}
            />
            <span className="text-sm text-zinc-700 group-hover:text-zinc-900">
              <span className="font-medium">Chcę uczyć się z tym korepetytorem w przyszłości</span>
              <br />
              <span className="text-zinc-400 text-xs">
                Korepetytor otrzyma powiadomienie o Twoim kolejnym zleceniu nieco wcześniej.
              </span>
            </span>
          </label>

          <label className="flex items-start gap-3 cursor-pointer group">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900 cursor-pointer"
              checked={preference === 'avoid'}
              onChange={() => togglePreference('avoid')}
            />
            <span className="text-sm text-zinc-700 group-hover:text-zinc-900">
              <span className="font-medium">Nie polecaj mi tego korepetytora</span>
              <br />
              <span className="text-zinc-400 text-xs">
                Ten korepetytor nie będzie pojawiał się w Twoim feedzie przy kolejnych zleceniach.
              </span>
            </span>
          </label>
        </div>
      )}

      {state?.message && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{state.message}</p>
      )}

      {/* Akcja — brak przycisku "Pomiń" (ADR-006 §1) */}
      <button
        type="submit"
        disabled={submitDisabled}
        className="cursor-pointer rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isPending ? 'Zapisywanie...' : 'Wyślij ocenę'}
      </button>
    </form>
  )
}
