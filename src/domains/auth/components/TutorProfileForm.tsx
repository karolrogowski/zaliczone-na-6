'use client'

import { useState } from 'react'
import { useActionState } from 'react'
import { saveTutorProfile } from '../actions'
import { MAX_BIO } from '../validation'
import { LEVEL_OPTIONS } from '@/domains/matching/options'
import type { Subject } from '@/domains/matching/types'
import type { TutorOwnProfile } from '../types'

const TUTOR_LEVEL_OPTIONS = LEVEL_OPTIONS.filter(o => o.value !== 'inne')

export function TutorProfileForm({
  subjects,
  profile,
}: {
  subjects: Subject[]
  profile: TutorOwnProfile | null
}) {
  const [state, formAction, isPending] = useActionState(saveTutorProfile, undefined)

  const [bio, setBio] = useState(profile?.bio ?? '')
  const [selectedSubjects, setSelectedSubjects] = useState<Set<string>>(
    () => new Set(profile?.tutor_subjects.map(ts => ts.subject_id) ?? [])
  )
  const [selectedLevels, setSelectedLevels] = useState<Set<string>>(
    () => new Set(profile?.levels ?? [])
  )
  const [hourlyRate, setHourlyRate] = useState(
    profile?.hourly_rate_grosz != null
      ? (profile.hourly_rate_grosz / 100).toFixed(2).replace('.', ',')
      : ''
  )

  const teachingDone = selectedSubjects.size > 0 && selectedLevels.size > 0
  const rateDone     = hourlyRate.trim().length > 0
  const requiredDone = (teachingDone ? 1 : 0) + (rateDone ? 1 : 0)
  const progress     = Math.round((requiredDone / 2) * 100)

  function toggleSubject(id: string) {
    setSelectedSubjects(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }
  function toggleLevel(val: string) {
    setSelectedLevels(prev => {
      const next = new Set(prev)
      if (next.has(val)) next.delete(val); else next.add(val)
      return next
    })
  }

  const inputCls = 'w-full px-3 py-[10px] border-[0.5px] border-[#d3d1c7] rounded-[8px] text-[13px] text-[#2c2c2a] bg-white outline-none placeholder:text-[#8a8980] focus:border-[#0F6E56] focus:ring-2 focus:ring-[#0F6E56]/15 transition-shadow font-[inherit]'

  return (
    <div className="flex flex-col h-full">

      {/* Content header */}
      <div className="shrink-0 bg-white border-b border-[#e8e6de] px-[26px] pt-[14px]">
        <div className="flex items-start justify-between pb-[10px]">
          <div>
            <h1 className="text-[16px] font-medium text-[#2c2c2a]">Twój profil</h1>
            <p className="text-[11px] text-[#888780] mt-[2px]">Wszystko co zobaczy uczeń zanim zdecyduje się na sesję</p>
          </div>
          {state?.errors && (
            <span className="text-[11px] text-red-600 mt-[3px]">Sprawdź błędy w formularzu</span>
          )}
        </div>
        <div className="flex items-center gap-3 pb-[10px]">
          <span className="text-[11px] font-medium text-[#5f5e5a] tabular-nums shrink-0">{progress}% uzupełnione</span>
          <div className="flex-1 h-[5px] bg-[#f5f5f3] rounded-[3px] overflow-hidden">
            <div
              className="h-full rounded-[3px] transition-all duration-300"
              style={{ width: `${progress}%`, backgroundColor: progress >= 100 ? '#639922' : '#BA7517' }}
            />
          </div>
          <span className="text-[11px] text-[#888780] shrink-0">{requiredDone} z 2 sekcji</span>
        </div>
      </div>

      {/* Form */}
      <form action={formAction} className="flex-1 overflow-hidden flex flex-col">

        {/* Hidden inputs for controlled chip state */}
        {Array.from(selectedSubjects).map(id => (
          <input key={id} type="hidden" name="subject_ids" value={id} />
        ))}
        {Array.from(selectedLevels).map(val => (
          <input key={val} type="hidden" name="levels" value={val} />
        ))}

        {/* Scrollable body */}
        <div className="flex-1 overflow-auto p-[20px_26px] flex flex-col gap-4">

          {/* Incomplete banner */}
          {requiredDone < 2 && (
            <div className="bg-[#FAEEDA] border border-[#BA7517]/30 rounded-[10px] p-[14px_16px] flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-[#BA7517] text-white flex items-center justify-center shrink-0">
                <svg className="w-[14px] h-[14px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
              </div>
              <div>
                <p className="text-[13px] font-medium text-[#633806] mb-0.5">Uzupełnij profil żeby zacząć przyjmować zlecenia</p>
                <p className="text-[12px] text-[#633806]/90 leading-[1.55]">
                  Bez wypełnionego profilu nie będziesz widoczny dla uczniów.{' '}
                  {requiredDone === 0 ? 'Brakuje 2 wymaganych sekcji.' : 'Brakuje 1 wymaganej sekcji.'}
                </p>
              </div>
            </div>
          )}

          {/* Section 1 — Czego uczysz */}
          <div className="bg-white border border-[#e8e6de] rounded-[12px] p-[18px_20px]">
            <div className="flex gap-3 mb-[14px]">
              <SectionNum done={teachingDone}>1</SectionNum>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[14px] font-medium text-[#2c2c2a]">Czego uczysz</span>
                  <RequiredBadge done={teachingDone} />
                </div>
                <p className="text-[12px] text-[#888780] leading-[1.5] mt-[3px]">Wybierz przedmioty i poziomy. Dostaniesz zlecenia tylko z tego co tutaj wskażesz.</p>
              </div>
            </div>

            <div className="flex flex-col gap-[14px]">
              <div>
                <p className="text-[11px] text-[#888780] uppercase tracking-[0.04em] font-medium mb-[6px]">Przedmioty</p>
                <div className="flex flex-wrap gap-[6px]">
                  {subjects.map(s => (
                    <Chip key={s.id} active={selectedSubjects.has(s.id)} onClick={() => toggleSubject(s.id)}>
                      {s.label}
                    </Chip>
                  ))}
                </div>
                {state?.errors?.subjects && (
                  <p className="text-sm text-red-600 mt-2">{state.errors.subjects[0]}</p>
                )}
              </div>

              <div>
                <p className="text-[11px] text-[#888780] uppercase tracking-[0.04em] font-medium mb-[6px]">Poziomy</p>
                <div className="flex flex-wrap gap-[6px]">
                  {TUTOR_LEVEL_OPTIONS.map(l => (
                    <Chip key={l.value} active={selectedLevels.has(l.value)} onClick={() => toggleLevel(l.value)}>
                      {l.label}
                    </Chip>
                  ))}
                </div>
                {state?.errors?.levels && (
                  <p className="text-sm text-red-600 mt-2">{state.errors.levels[0]}</p>
                )}
              </div>
            </div>
          </div>

          {/* Section 2 — O mnie */}
          <div className="bg-white border border-[#e8e6de] rounded-[12px] p-[18px_20px]">
            <div className="flex gap-3 mb-[14px]">
              <SectionNum done={bio.trim().length > 0}>2</SectionNum>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[14px] font-medium text-[#2c2c2a]">O mnie</span>
                  <span className="text-[10px] px-[7px] py-[2px] bg-[#f5f5f3] text-[#888780] rounded-[10px]">Opcjonalne</span>
                </div>
                <p className="text-[12px] text-[#888780] leading-[1.5] mt-[3px]">Krótki opis — skąd jesteś, co studiujesz, jakie masz podejście do nauki.</p>
              </div>
            </div>

            <textarea
              name="bio"
              rows={5}
              placeholder="Np. Jestem studentem matematyki na PW. Korepetycji udzielam od 4 lat. Specjalizuję się w analizie matematycznej..."
              value={bio}
              onChange={e => setBio(e.target.value)}
              maxLength={MAX_BIO}
              className={`${inputCls} resize-y min-h-[76px] leading-[1.6]`}
            />
            <div className="flex items-center justify-between mt-[2px]">
              <span className="text-[11px] text-[#888780]">Pisz konkretnie — co potrafisz tłumaczyć i jak pracujesz.</span>
              <span className={`text-[11px] tabular-nums ${bio.length >= MAX_BIO * 0.9 ? 'text-[#BA7517]' : 'text-[#888780]'}`}>
                {bio.length} / {MAX_BIO}
              </span>
            </div>
            {state?.errors?.bio && (
              <p className="text-sm text-red-600 mt-1">{state.errors.bio[0]}</p>
            )}
          </div>

          {/* Section 3 — Stawka godzinowa */}
          <div className="bg-white border border-[#e8e6de] rounded-[12px] p-[18px_20px]">
            <div className="flex gap-3 mb-[14px]">
              <SectionNum done={rateDone}>3</SectionNum>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[14px] font-medium text-[#2c2c2a]">Stawka godzinowa</span>
                  <RequiredBadge done={rateDone} />
                </div>
                <p className="text-[12px] text-[#888780] leading-[1.5] mt-[3px]">Twoja stawka za 60-minutową sesję.</p>
              </div>
            </div>

            <div className="relative w-36">
              <input
                name="hourly_rate_pln"
                type="text"
                inputMode="decimal"
                placeholder="np. 80"
                value={hourlyRate}
                onChange={e => setHourlyRate(e.target.value)}
                className={`${inputCls} pr-14`}
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-[#888780]">
                PLN/h
              </span>
            </div>
            {state?.errors?.hourly_rate && (
              <p className="text-sm text-red-600 mt-2">{state.errors.hourly_rate[0]}</p>
            )}
          </div>

          {state?.message && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{state.message}</p>
          )}
        </div>

        {/* Save bar */}
        <div className="shrink-0 bg-white border-t border-[#e8e6de] px-[26px] py-3 flex items-center justify-between">
          <div className="flex items-center gap-[6px] text-[12px] text-[#5f5e5a]">
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            Zmiany zapisują się po kliknięciu Zapisz
          </div>
          <div className="flex items-center gap-2">
            <a
              href="/profile"
              className="px-[14px] py-[9px] border-[0.5px] border-[#d3d1c7] rounded-[8px] text-[12px] text-[#5f5e5a] hover:border-[#888780] hover:text-[#2c2c2a] transition-colors"
            >
              Anuluj zmiany
            </a>
            <button
              type="submit"
              disabled={isPending}
              className="flex items-center gap-[6px] px-[18px] py-[9px] bg-[#0F6E56] text-white text-[13px] font-medium rounded-[8px] hover:bg-[#085041] disabled:opacity-50 transition-colors cursor-pointer"
            >
              {isPending ? 'Zapisywanie...' : 'Zapisz'}
              {!isPending && (
                <svg className="w-[13px] h-[13px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              )}
            </button>
          </div>
        </div>

      </form>
    </div>
  )
}

function SectionNum({ done, children }: { done: boolean; children: React.ReactNode }) {
  return (
    <span
      className="w-[22px] h-[22px] rounded-full flex items-center justify-center text-[11px] font-medium shrink-0 border-[0.5px]"
      style={done
        ? { backgroundColor: '#EAF3DE', borderColor: 'transparent', color: '#27500A' }
        : { backgroundColor: '#f5f5f3', borderColor: '#e8e6de', color: '#888780' }}
    >
      {children}
    </span>
  )
}

function RequiredBadge({ done }: { done: boolean }) {
  return (
    <span
      className="text-[10px] px-[7px] py-[2px] rounded-[10px] font-medium"
      style={done
        ? { backgroundColor: '#EAF3DE', color: '#27500A' }
        : { backgroundColor: '#FAEEDA', color: '#633806' }}
    >
      {done ? '✓ Wymagane' : 'Wymagane'}
    </span>
  )
}

function Chip({ active, onClick, children }: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-[5px] px-3 py-[6px] rounded-[18px] text-[12px] cursor-pointer transition-all border-[0.5px]"
      style={active ? {
        backgroundColor: '#E1F5EE',
        color: '#085041',
        borderColor: 'transparent',
        fontWeight: 500,
        paddingLeft: 9,
      } : {
        backgroundColor: 'white',
        borderColor: '#d3d1c7',
        color: '#5f5e5a',
      }}
    >
      {active && (
        <span
          className="w-3 h-3 rounded-full shrink-0 inline-block"
          style={{
            backgroundColor: '#0F6E56',
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='20 6 9 17 4 12'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'center',
            backgroundSize: '8px',
          }}
        />
      )}
      {children}
    </button>
  )
}
