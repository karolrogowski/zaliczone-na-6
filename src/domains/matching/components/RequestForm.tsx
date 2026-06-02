'use client'

import { useState, useActionState } from 'react'
import { submitMatchingRequest } from '../actions'
import { LEVEL_OPTIONS } from '../options'
import type { Subject } from '../types'

const inputCls = 'w-full px-3 py-[10px] border-[0.5px] border-[#d3d1c7] rounded-[8px] text-[13px] text-[#2c2c2a] bg-white outline-none placeholder:text-[#8a8980] focus:border-[#185FA5] focus:ring-2 focus:ring-[#185FA5]/15 transition-shadow font-[inherit]'
const selectCls = `${inputCls} cursor-pointer`

export function RequestForm({ subjects }: { subjects: Subject[] }) {
  const [state, action, pending] = useActionState(submitMatchingRequest, undefined)
  const [levelCode, setLevelCode] = useState('')

  return (
    <div className="flex flex-col h-full">
      <div className="shrink-0 bg-white border-b border-[#e8e6de] px-[26px] py-4">
        <h1 className="text-[16px] font-medium text-[#2c2c2a]">Zamów korepetytora</h1>
        <p className="text-[11px] text-[#888780] mt-[2px]">Dostępny korepetytor przyjmie zlecenie w ciągu kilku minut.</p>
      </div>

      <form action={action} className="flex-1 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-auto p-[22px_26px]">
          <div className="mx-auto max-w-xl flex flex-col gap-4">

            <div className="bg-white border border-[#e8e6de] rounded-[12px] p-[18px_20px] flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="subject_id" className="text-[12px] font-medium text-[#5f5e5a]">
                  Przedmiot
                </label>
                <select id="subject_id" name="subject_id" required defaultValue="" className={selectCls}>
                  <option value="" disabled>Wybierz przedmiot...</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>{s.label}</option>
                  ))}
                </select>
                {state?.errors?.subject_id && (
                  <p className="text-[12px] text-red-600">{state.errors.subject_id[0]}</p>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="level" className="text-[12px] font-medium text-[#5f5e5a]">
                  Poziom
                </label>
                <select
                  id="level"
                  name="level"
                  required
                  value={levelCode}
                  onChange={(e) => setLevelCode(e.target.value)}
                  className={selectCls}
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
                    className={inputCls}
                  />
                )}
                {state?.errors?.level && (
                  <p className="text-[12px] text-red-600">{state.errors.level[0]}</p>
                )}
              </div>
            </div>

            <div className="bg-white border border-[#e8e6de] rounded-[12px] p-[18px_20px] flex flex-col gap-3">
              <div>
                <p className="text-[14px] font-medium text-[#2c2c2a]">Co chcesz przerobić?</p>
                <p className="text-[12px] text-[#888780] mt-[3px] leading-[1.5]">
                  Opisz temat i zagadnienia. Im więcej szczegółów, tym szybciej korepetytor się przygotuje.
                </p>
              </div>
              <textarea
                id="description"
                name="description"
                rows={5}
                required
                placeholder="np. Nie rozumiem całkowania przez podstawienie, jutro sprawdzian z rozdziału 5..."
                className={`${inputCls} resize-none leading-[1.6]`}
              />
              {state?.errors?.description && (
                <p className="text-[12px] text-red-600">{state.errors.description[0]}</p>
              )}
            </div>

            {state?.message && (
              <p className="rounded-[8px] bg-red-50 px-3 py-2 text-[13px] text-red-600">{state.message}</p>
            )}
          </div>
        </div>

        <div className="shrink-0 bg-white border-t border-[#e8e6de] px-[26px] py-3 flex items-center justify-end">
          <button
            type="submit"
            disabled={pending}
            className="flex items-center gap-2 px-[22px] py-[11px] bg-[#185FA5] text-white text-[13px] font-medium rounded-[9px] hover:bg-[#0C447C] disabled:opacity-50 transition-colors cursor-pointer"
            style={{ boxShadow: '0 1px 0 rgba(12,68,124,0.3)' }}
          >
            {pending ? 'Szukamy korepetytora...' : (
              <>
                <svg className="w-[14px] h-[14px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                Znajdź korepetytora
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
