'use client'

import { useActionState, useState, useEffect } from 'react'
import { submitRating, updateRating } from '../actions'
import { MIN_COMMENT_LOW_SCORE } from '../validation'
import type { JustificationCategory } from '../types'

type ExistingRating = {
  score_knowledge:    number
  score_organization: number
  score_communication: number
  comment:            string | null
  justification_category: string | null
  preference:         string | null
  editableUntil:      string   // ISO string
}

type RatingFormProps = {
  requestId:      string
  role:           'student' | 'tutor'
  otherPersonName?: string
  existingRating?: ExistingRating
}

const STAR_LABELS = ['', 'Bardzo słabo', 'Słabo', 'Średnio', 'Dobrze', 'Doskonale']

const JUSTIFICATION_OPTIONS: { value: JustificationCategory; label: string }[] = [
  { value: 'late_or_cancelled', label: 'Spóźnienie / odwołanie zajęć' },
  { value: 'unprepared',        label: 'Brak przygotowania / materiałów' },
  { value: 'low_quality',       label: 'Niska jakość merytoryczna' },
  { value: 'communication',     label: 'Problemy z komunikacją' },
  { value: 'misconduct',        label: 'Niewłaściwe zachowanie' },
  { value: 'other',             label: 'Inne' },
]

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
        <span className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-zinc-900" aria-hidden="true" />
      </span>
    </span>
  )
}

function StarRow({
  name, label, value, hovered, onChange, onHover, onLeave, error,
}: {
  name: string; label: string; value: number; hovered: number
  onChange: (v: number) => void; onHover: (v: number) => void; onLeave: () => void
  error?: string
}) {
  const active = hovered || value
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-sm font-medium text-zinc-700">{label}</p>
      <div className="flex gap-1.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <label key={star} className="cursor-pointer" onMouseEnter={() => onHover(star)} onMouseLeave={onLeave}>
            <input
              type="radio"
              name={name}
              value={star}
              className="sr-only"
              onChange={() => onChange(star)}
              checked={value === star}
            />
            <span className={`text-3xl leading-none transition-colors select-none ${star <= active ? 'text-yellow-400' : 'text-zinc-200'}`}>★</span>
          </label>
        ))}
      </div>
      {value > 0 && <p className="text-xs text-zinc-400">{STAR_LABELS[value]}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}

function EditCountdown({ editableUntil }: { editableUntil: string }) {
  const [secondsLeft, setSecondsLeft] = useState(() =>
    Math.max(0, Math.floor((new Date(editableUntil).getTime() - Date.now()) / 1000))
  )

  useEffect(() => {
    if (secondsLeft <= 0) return
    const id = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(id)
  }, [secondsLeft])

  if (secondsLeft <= 0) return null
  const m = Math.floor(secondsLeft / 60)
  const s = secondsLeft % 60
  return (
    <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
      Możesz edytować ocenę jeszcze przez {m}:{String(s).padStart(2, '0')}
    </p>
  )
}

export function RatingForm({ requestId, role, otherPersonName, existingRating }: RatingFormProps) {
  const [state, formAction, isPending] = useActionState(
    existingRating ? updateRating : submitRating,
    undefined
  )

  const [scoreK, setScoreK] = useState(existingRating?.score_knowledge    ?? 0)
  const [scoreO, setScoreO] = useState(existingRating?.score_organization  ?? 0)
  const [scoreC, setScoreC] = useState(existingRating?.score_communication ?? 0)
  const [hoveredK, setHoveredK] = useState(0)
  const [hoveredO, setHoveredO] = useState(0)
  const [hoveredC, setHoveredC] = useState(0)

  const [comment,   setComment]   = useState(existingRating?.comment ?? '')
  const [category,  setCategory]  = useState<string>(existingRating?.justification_category ?? '')
  const [preference, setPreference] = useState<'want_again' | 'avoid' | ''>(
    (existingRating?.preference as 'want_again' | 'avoid' | null) ?? ''
  )
  const [tutorFlagged, setTutorFlagged] = useState(false)

  const isStudent = role === 'student'
  const avgScoreVal = scoreK && scoreO && scoreC ? (scoreK + scoreO + scoreC) / 3 : null
  const needsComment = avgScoreVal !== null && avgScoreVal < 4
  const commentTooShort = needsComment && comment.length < MIN_COMMENT_LOW_SCORE
  const allDimensionsSelected = isStudent ? (scoreK > 0 && scoreO > 0 && scoreC > 0) : true
  const submitDisabled = isPending || !allDimensionsSelected || (isStudent && commentTooShort)

  const heading = isStudent
    ? (otherPersonName ? `Oceń korepetytora ${otherPersonName}` : 'Oceń korepetytora')
    : (otherPersonName ? `Oceń ucznia ${otherPersonName}` : 'Oceń ucznia')

  const subheading = isStudent
    ? 'Twoja ocena pomaga innym uczniom wybrać najlepszego korepetytora.'
    : 'Twoja ocena pomaga nam dbać o jakość społeczności uczniów na platformie.'

  const isEditMode = existingRating !== undefined

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <input type="hidden" name="request_id" value={requestId} />
      <input type="hidden" name="rated_by"   value={role} />
      <input type="hidden" name="preference" value={isStudent ? preference : ''} />
      <input type="hidden" name="tutor_preference" value={!isStudent && tutorFlagged ? 'flag' : ''} />

      {/* Nagłówek */}
      <div>
        <h2 className="mb-1 text-lg font-semibold text-zinc-900">
          {isEditMode ? `Edytuj ocenę — ` : ''}{heading}
        </h2>
        <p className="text-sm text-zinc-500">{subheading}</p>
      </div>

      {isEditMode && existingRating && (
        <EditCountdown editableUntil={existingRating.editableUntil} />
      )}

      {/* 3 wymiary gwiazdek — tylko dla ucznia */}
      {isStudent && (
        <div className="flex flex-col gap-4">
          <StarRow
            name="score_knowledge" label="Merytoryka"
            value={scoreK} hovered={hoveredK}
            onChange={setScoreK} onHover={setHoveredK} onLeave={() => setHoveredK(0)}
            error={state?.errors?.score_knowledge?.[0]}
          />
          <StarRow
            name="score_organization" label="Organizacja"
            value={scoreO} hovered={hoveredO}
            onChange={setScoreO} onHover={setHoveredO} onLeave={() => setHoveredO(0)}
            error={state?.errors?.score_organization?.[0]}
          />
          <StarRow
            name="score_communication" label="Komunikacja"
            value={scoreC} hovered={hoveredC}
            onChange={setScoreC} onHover={setHoveredC} onLeave={() => setHoveredC(0)}
            error={state?.errors?.score_communication?.[0]}
          />
        </div>
      )}

      {/* Kategoria uzasadnienia — pojawia się gdy avgScore < 4 */}
      {isStudent && needsComment && (
        <div className="flex flex-col gap-2">
          <label htmlFor="justification_category" className="text-sm font-medium text-zinc-700">
            Kategoria problemu <span className="font-normal text-zinc-400">(opcjonalnie)</span>
          </label>
          <select
            id="justification_category"
            name="justification_category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900 bg-white"
          >
            <option value="">Wybierz kategorię...</option>
            {JUSTIFICATION_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      )}

      {/* Komentarz — tylko dla ucznia */}
      {isStudent && (
        <div className="flex flex-col gap-2">
          <label htmlFor="comment" className="text-sm font-medium text-zinc-700">
            Komentarz{' '}
            {needsComment ? (
              <span className="font-normal text-red-600">(wymagany przy ocenie poniżej 4★)</span>
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
      )}

      {/* Preferencje ucznia */}
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
                Dodaj do ulubionych
              </button>
              <InfoTooltip content="Korepetytor trafi na Twoją listę ulubionych i będzie powiadamiany o Twoich zleceniach jako pierwszy. Możesz usunąć go z ulubionych w dowolnym momencie w Ustawieniach." />
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

      {/* Flaga korepetytora + prywatna notatka */}
      {!isStudent && (
        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium text-zinc-700">
            Uwagi <span className="font-normal text-zinc-400">(opcjonalnie)</span>
          </p>
          <label className="flex items-start gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={tutorFlagged}
              onChange={(e) => {
                setTutorFlagged(e.target.checked)
                if (!e.target.checked) setComment('')
              }}
              className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900 cursor-pointer"
            />
            <span className="text-sm text-zinc-700 group-hover:text-zinc-900">
              <span className="inline-flex items-center gap-1.5 font-medium">
                Oznacz tego ucznia jako problematycznego
                <InfoTooltip content="Przy kolejnych zleceniach od tego ucznia zobaczysz w karcie zlecenia znacznik ⚠️ jako prywatne przypomnienie. Uczeń nadal może zostać Ci przydzielony — to nie jest blokada, tylko notatka widoczna wyłącznie dla Ciebie." />
              </span>
            </span>
          </label>
          {tutorFlagged && (
            <div className="flex flex-col gap-1.5 ml-7">
              <label htmlFor="tutor-note" className="text-sm text-zinc-600">
                Prywatna notatka{' '}
                <span className="text-zinc-400">(opcjonalnie, widoczna tylko dla Ciebie)</span>
              </label>
              <textarea
                id="tutor-note"
                name="comment"
                rows={3}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Co chcesz zapamiętać o tej sesji lub uczniu?"
                className="rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900 resize-none"
              />
              {state?.errors?.comment && (
                <p className="text-sm text-red-600">{state.errors.comment[0]}</p>
              )}
            </div>
          )}
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
        {isPending ? 'Zapisywanie...' : isEditMode ? 'Zapisz zmiany' : 'Wyślij ocenę'}
      </button>
    </form>
  )
}
