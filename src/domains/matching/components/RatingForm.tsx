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

function InfoTooltip({ content }: { content: string }) {
  return (
    <span className="relative inline-flex group/tip">
      <span
        tabIndex={0}
        role="button"
        aria-label="Więcej informacji"
        className="inline-flex h-4 w-4 cursor-default items-center justify-center rounded-full bg-zinc-200 text-[10px] font-bold text-zinc-500 hover:bg-zinc-300 focus:outline-none focus:ring-1 focus:ring-zinc-400 select-none"
      >
        i
      </span>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-64 -translate-x-1/2 rounded-xl bg-zinc-900 px-3 py-2.5 text-xs leading-relaxed text-zinc-100 opacity-0 shadow-lg transition-opacity group-hover/tip:opacity-100 group-focus-within/tip:opacity-100"
      >
        {content}
        <span
          className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-zinc-900"
          aria-hidden="true"
        />
      </span>
    </span>
  )
}

export function RatingForm({ requestId, role, otherPersonName }: RatingFormProps) {
  const [state, formAction, isPending] = useActionState(submitRating, undefined)
  const [hovered,       setHovered]       = useState(0)
  const [selected,      setSelected]      = useState(0)
  const [comment,       setComment]       = useState('')
  const [preference,    setPreference]    = useState<'want_again' | 'avoid' | ''>('')
  const [tutorFlagged,  setTutorFlagged]  = useState(false)

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

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <input type="hidden" name="request_id" value={requestId} />
      <input type="hidden" name="rated_by"   value={role} />
      {/* preference: dotyczy ucznia — 'want_again' | 'avoid' | '' */}
      <input type="hidden" name="preference" value={isStudent ? preference : ''} />
      {/* tutor_preference: dotyczy korepetytora — 'flag' | '' */}
      <input type="hidden" name="tutor_preference" value={!isStudent && tutorFlagged ? 'flag' : ''} />

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

      {/* Preferencje ucznia — toggle chips (kliknięcie aktywnego = odznacza) */}
      {isStudent && (
        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium text-zinc-700">
            Preferencje <span className="font-normal text-zinc-400">(opcjonalnie)</span>
          </p>

          <div className="flex flex-col gap-2" role="group" aria-label="Preferencje dotyczące korepetytora">
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-pressed={preference === 'want_again'}
                onClick={() => setPreference(preference === 'want_again' ? '' : 'want_again')}
                className={`flex flex-1 items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-900 ${
                  preference === 'want_again'
                    ? 'border-green-600 bg-green-50 text-green-800'
                    : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50'
                }`}
              >
                <span aria-hidden="true">★</span>
                Chcę uczyć się z tym korepetytorem w przyszłości
              </button>
              <InfoTooltip content="Korepetytor zobaczy przy Twoim kolejnym zleceniu oznaczenie, że go preferujesz — może to zachęcić go do szybszej akceptacji. Preferencja pozostaje aktywna bezterminowo i możesz ją zmienić przy kolejnej ocenie." />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-pressed={preference === 'avoid'}
                onClick={() => setPreference(preference === 'avoid' ? '' : 'avoid')}
                className={`flex flex-1 items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-900 ${
                  preference === 'avoid'
                    ? 'border-red-600 bg-red-50 text-red-800'
                    : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50'
                }`}
              >
                <span aria-hidden="true">{'×'}</span>
                Nie polecaj mi tego korepetytora
              </button>
              <InfoTooltip content={'Korepetytor nie zobaczy żadnego Twojego przyszłego zlecenia i nie będzie mógł go zaakceptować. Blokadę możesz cofnąć w dowolnym momencie w Ustawieniach → sekcja „Zablokowani korepetytorzy".'} />
            </div>
          </div>
        </div>
      )}

      {/* Flaga korepetytora — checkbox (pojedynczy wybór) */}
      {!isStudent && (
        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium text-zinc-700">
            Uwagi <span className="font-normal text-zinc-400">(opcjonalnie)</span>
          </p>
          <label className="flex items-start gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={tutorFlagged}
              onChange={(e) => setTutorFlagged(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900 cursor-pointer"
            />
            <span className="text-sm text-zinc-700 group-hover:text-zinc-900">
              <span className="inline-flex items-center gap-1.5 font-medium">
                Oznacz tego ucznia jako problematycznego
                <InfoTooltip content="Przy kolejnych zleceniach od tego ucznia zobaczysz w karcie zlecenia znacznik ⚠️ jako prywatne przypomnienie. Uczeń nadal może zostać Ci przydzielony — to nie jest blokada, tylko notatka widoczna wyłącznie dla Ciebie." />
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
