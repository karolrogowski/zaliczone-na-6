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
  editableUntil:      string
}

type RatingFormProps = {
  requestId:      string
  role:           'student' | 'tutor'
  otherPersonName?: string
  existingRating?: ExistingRating
  isMandatory?:   boolean
}

const inputCls = 'w-full px-3 py-[10px] border-[0.5px] border-[#d3d1c7] rounded-[8px] text-[13px] text-[#2c2c2a] bg-white outline-none placeholder:text-[#8a8980] focus:border-[#185FA5] focus:ring-2 focus:ring-[#185FA5]/15 transition-shadow font-[inherit]'

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
        className="inline-flex h-4 w-4 cursor-default items-center justify-center rounded-full bg-[#f5f5f3] text-[10px] font-bold text-[#888780] hover:bg-[#e8e6de] focus:outline-none focus:ring-1 focus:ring-[#d3d1c7] select-none"
      >
        i
      </span>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-64 -translate-x-1/2 rounded-[10px] bg-[#2c2c2a] px-3 py-2.5 text-xs leading-relaxed text-white opacity-0 shadow-lg transition-opacity group-hover/tip:opacity-100 group-focus-within/tip:opacity-100"
      >
        {content}
        <span className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-[#2c2c2a]" aria-hidden="true" />
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
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] font-medium text-[#2c2c2a]">{label}</p>
        {active > 0 && (
          <span className="text-[11px] text-[#888780]">{STAR_LABELS[active]}</span>
        )}
      </div>
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
            <span className={`text-[28px] leading-none transition-colors select-none ${star <= active ? 'text-yellow-400' : 'text-[#e8e6de]'}`}>★</span>
          </label>
        ))}
      </div>
      {error && <p className="text-[12px] text-red-600">{error}</p>}
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
    <span className="text-[12px] text-[#888780]">
      Edycja możliwa przez{' '}
      <span className="font-mono font-medium text-[#5f5e5a]">{m}:{String(s).padStart(2, '0')}</span>
    </span>
  )
}

export function RatingForm({ requestId, role, otherPersonName, existingRating, isMandatory }: RatingFormProps) {
  const [state, formAction, isPending] = useActionState(
    existingRating ? updateRating : submitRating,
    undefined
  )

  const isStudent = role === 'student'
  const isEditMode = existingRating !== undefined

  // --- Student state ---
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

  // --- Tutor state ---
  const [tutorMode, setTutorMode] = useState<'ok' | 'flag'>('ok')
  const [tutorNote, setTutorNote] = useState('')

  const avgScoreVal = scoreK && scoreO && scoreC ? (scoreK + scoreO + scoreC) / 3 : null
  const needsComment = avgScoreVal !== null && avgScoreVal < 4
  const commentTooShort = needsComment && comment.length < MIN_COMMENT_LOW_SCORE
  const allStarsSelected = scoreK > 0 && scoreO > 0 && scoreC > 0
  const submitDisabled = isStudent
    ? isPending || !allStarsSelected || (needsComment && commentTooShort)
    : isPending

  // ── TUTOR LAYOUT ──────────────────────────────────────────────────────────
  if (!isStudent) {
    const subtitle = otherPersonName ? `Sesja z ${otherPersonName}` : 'Opinia o sesji'
    return (
      <div className="flex flex-col h-full">
        <div className="shrink-0 bg-white border-b border-[#e8e6de] px-[26px] py-4">
          <h1 className="text-[16px] font-medium text-[#2c2c2a]">Opinia o sesji</h1>
          <p className="text-[11px] text-[#888780] mt-[2px]">{subtitle}</p>
        </div>

        <form action={formAction} className="flex-1 overflow-hidden flex flex-col">
          <input type="hidden" name="request_id" value={requestId} />
          <input type="hidden" name="rated_by" value="tutor" />
          <input type="hidden" name="preference" value="" />
          <input type="hidden" name="tutor_preference" value={tutorMode === 'flag' ? 'flag' : ''} />

          <div className="flex-1 overflow-auto p-[22px_26px]">
            <div className="mx-auto max-w-lg flex flex-col gap-4">
              <p className="text-[13px] text-[#5f5e5a]">
                Jak przebiegła ta sesja?
              </p>

              <button
                type="button"
                onClick={() => setTutorMode('ok')}
                className={`flex items-start gap-4 p-4 rounded-[12px] border-[0.5px] text-left transition-all ${
                  tutorMode === 'ok'
                    ? 'bg-[#EAF3DE] border-[#b8e0c5]'
                    : 'bg-white border-[#d3d1c7] hover:border-[#888780]'
                }`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                  tutorMode === 'ok' ? 'bg-[#0F6E56] text-white' : 'bg-[#f5f5f3] text-[#888780]'
                }`}>
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                </div>
                <div>
                  <p className="text-[14px] font-medium text-[#2c2c2a]">Sesja bez uwag</p>
                  <p className="text-[12px] text-[#888780] mt-[2px] leading-[1.5]">Zajęcia przebiegły prawidłowo.</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setTutorMode('flag')}
                className={`flex items-start gap-4 p-4 rounded-[12px] border-[0.5px] text-left transition-all ${
                  tutorMode === 'flag'
                    ? 'bg-[#FAEEDA] border-[#BA7517]/40'
                    : 'bg-white border-[#d3d1c7] hover:border-[#888780]'
                }`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                  tutorMode === 'flag' ? 'bg-[#BA7517] text-white' : 'bg-[#f5f5f3] text-[#888780]'
                }`}>
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                </div>
                <div>
                  <p className="text-[14px] font-medium text-[#2c2c2a]">Zgłoś problem z uczniem</p>
                  <p className="text-[12px] text-[#888780] mt-[2px] leading-[1.5]">
                    Uczeń zostanie oznaczony jako problematyczny — to Twoja prywatna notatka, niewidoczna dla ucznia.
                  </p>
                </div>
              </button>

              {tutorMode === 'flag' && (
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="tutor-note" className="text-[12px] font-medium text-[#5f5e5a]">
                    Prywatna notatka <span className="font-normal text-[#888780]">(opcjonalnie)</span>
                  </label>
                  <textarea
                    id="tutor-note"
                    name="comment"
                    rows={3}
                    value={tutorNote}
                    onChange={(e) => setTutorNote(e.target.value)}
                    placeholder="Co chcesz zapamiętać o tej sesji lub uczniu?"
                    className={`${inputCls} resize-none leading-[1.6]`}
                  />
                  {state?.errors?.comment && (
                    <p className="text-[12px] text-red-600">{state.errors.comment[0]}</p>
                  )}
                </div>
              )}

              {state?.message && (
                <p className="rounded-[8px] bg-red-50 px-3 py-2 text-[13px] text-red-600">{state.message}</p>
              )}
            </div>
          </div>

          <div className="shrink-0 bg-white border-t border-[#e8e6de] px-[26px] py-3 flex items-center justify-end">
            <button
              type="submit"
              disabled={submitDisabled}
              className="cursor-pointer flex items-center gap-[6px] px-[18px] py-[9px] bg-[#185FA5] text-white text-[13px] font-medium rounded-[8px] hover:bg-[#0C447C] disabled:opacity-50 transition-colors"
            >
              {isPending ? 'Zapisywanie...' : 'Zapisz'}
            </button>
          </div>
        </form>
      </div>
    )
  }

  // ── STUDENT LAYOUT ────────────────────────────────────────────────────────
  const title = isEditMode ? 'Edytuj ocenę' : 'Oceń korepetytora'
  const subtitle = otherPersonName ?? 'Twoja ocena pomaga innym uczniom wybrać najlepszego korepetytora.'

  return (
    <div className="flex flex-col h-full">
      <div className="shrink-0 bg-white border-b border-[#e8e6de] px-[26px] py-4">
        <h1 className="text-[16px] font-medium text-[#2c2c2a]">{title}</h1>
        <p className="text-[11px] text-[#888780] mt-[2px]">{subtitle}</p>
      </div>

      <form action={formAction} className="flex-1 overflow-hidden flex flex-col">
        <input type="hidden" name="request_id" value={requestId} />
        <input type="hidden" name="rated_by" value="student" />
        <input type="hidden" name="preference" value={preference} />
        <input type="hidden" name="tutor_preference" value="" />

        <div className="flex-1 overflow-auto p-[22px_26px]">
          <div className="mx-auto max-w-lg flex flex-col gap-4">

            {isMandatory && (
              <div className="bg-[#FAEEDA] border border-[#BA7517]/30 rounded-[10px] px-4 py-3 text-[13px] text-[#633806]">
                <span className="font-medium">Ocena jest wymagana przed przejściem dalej.</span>{' '}
                Platforma tymczasowo blokuje nawigację — wyślij ocenę, aby odblokować dostęp.
              </div>
            )}

            {/* Gwiazdki */}
            <div className="bg-white border border-[#e8e6de] rounded-[12px] p-[18px_20px] flex flex-col gap-5">
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

            {/* Komentarz */}
            <div className="bg-white border border-[#e8e6de] rounded-[12px] p-[18px_20px] flex flex-col gap-3">
              {needsComment && (
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="justification_category" className="text-[12px] font-medium text-[#5f5e5a]">
                    Kategoria problemu <span className="font-normal text-[#888780]">(opcjonalnie)</span>
                  </label>
                  <select
                    id="justification_category"
                    name="justification_category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className={`${inputCls} cursor-pointer`}
                  >
                    <option value="">Wybierz kategorię...</option>
                    {JUSTIFICATION_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <label htmlFor="comment" className="text-[12px] font-medium text-[#5f5e5a]">
                  Komentarz{' '}
                  {needsComment
                    ? <span className="font-normal text-red-600">(wymagany przy ocenie poniżej 4★)</span>
                    : <span className="font-normal text-[#888780]">(opcjonalnie)</span>
                  }
                </label>
                <textarea
                  id="comment"
                  name="comment"
                  rows={3}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder={needsComment ? `Opisz powód niskiej oceny (min. ${MIN_COMMENT_LOW_SCORE} znaków)...` : 'Co sądzisz o tej sesji?'}
                  className={`${inputCls} resize-none leading-[1.6]`}
                />
                {needsComment && (
                  <p className={`text-[11px] ${commentTooShort ? 'text-red-500' : 'text-[#888780]'}`}>
                    {comment.length} / {MIN_COMMENT_LOW_SCORE} znaków minimum
                  </p>
                )}
                {state?.errors?.comment && (
                  <p className="text-[12px] text-red-600">{state.errors.comment[0]}</p>
                )}
              </div>
            </div>

            {/* Preferencje */}
            <div className="bg-white border border-[#e8e6de] rounded-[12px] p-[18px_20px] flex flex-col gap-3">
              <div className="flex items-center gap-1.5">
                <p className="text-[13px] font-medium text-[#2c2c2a]">Preferencje</p>
                <span className="text-[11px] text-[#888780]">(opcjonalnie)</span>
              </div>
              <div className="flex flex-col gap-2" role="group" aria-label="Preferencje dotyczące korepetytora">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    aria-pressed={preference === 'want_again'}
                    onClick={() => setPreference(preference === 'want_again' ? '' : 'want_again')}
                    className={`flex flex-1 items-center gap-2 rounded-[8px] border-[0.5px] px-3 py-2.5 text-left text-[13px] font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[#185FA5]/20 ${
                      preference === 'want_again'
                        ? 'border-transparent bg-[#EAF3DE] text-[#27500A]'
                        : 'border-[#d3d1c7] bg-white text-[#5f5e5a] hover:border-[#888780]'
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
                    className={`flex flex-1 items-center gap-2 rounded-[8px] border-[0.5px] px-3 py-2.5 text-left text-[13px] font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[#185FA5]/20 ${
                      preference === 'avoid'
                        ? 'border-transparent bg-red-50 text-red-800'
                        : 'border-[#d3d1c7] bg-white text-[#5f5e5a] hover:border-[#888780]'
                    }`}
                  >
                    <span aria-hidden="true">×</span>
                    Nie polecaj mi tego korepetytora
                  </button>
                  <InfoTooltip content={'Korepetytor nie zobaczy żadnego Twojego przyszłego zlecenia i nie będzie mógł go zaakceptować. Blokadę możesz cofnąć w dowolnym momencie w Ustawieniach → sekcja „Zablokowani korepetytorzy”.'} />
                </div>
              </div>
            </div>

            {state?.message && (
              <p className="rounded-[8px] bg-red-50 px-3 py-2 text-[13px] text-red-600">{state.message}</p>
            )}
          </div>
        </div>

        <div className="shrink-0 bg-white border-t border-[#e8e6de] px-[26px] py-3 flex items-center justify-between">
          <div>
            {isEditMode && existingRating && (
              <EditCountdown editableUntil={existingRating.editableUntil} />
            )}
          </div>
          <button
            type="submit"
            disabled={submitDisabled}
            className="cursor-pointer flex items-center gap-[6px] px-[18px] py-[9px] bg-[#185FA5] text-white text-[13px] font-medium rounded-[8px] hover:bg-[#0C447C] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isPending ? 'Zapisywanie...' : isEditMode ? 'Zapisz zmiany' : 'Wyślij ocenę'}
          </button>
        </div>
      </form>
    </div>
  )
}
