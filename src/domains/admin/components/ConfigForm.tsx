'use client'

import { useActionState, useTransition } from 'react'
import { updateCommissionPct, toggleSubjectActive } from '../actions'

type Subject = { id: string; label: string; is_active: boolean }
type Config = { key: string; value: string; description: string | null }

export function ConfigForm({
  configs,
  subjects,
}: {
  configs: Config[]
  subjects: Subject[]
}) {
  const commissionConfig = configs.find((c) => c.key === 'commission_pct')
  const [state, action, pending] = useActionState(updateCommissionPct, undefined)

  return (
    <div className="flex flex-col gap-8">
      <section className="rounded-2xl border border-zinc-200 bg-white p-6">
        <h2 className="mb-4 font-semibold text-zinc-900">Prowizja platformy</h2>
        <form action={action} className="flex items-end gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="commission_pct" className="text-sm font-medium text-zinc-700">
              Prowizja (%)
            </label>
            <input
              id="commission_pct"
              name="commission_pct"
              type="number"
              min={0}
              max={100}
              defaultValue={commissionConfig?.value ?? '20'}
              className="w-28 rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
            />
            {state?.errors?.commission_pct && (
              <p className="text-sm text-red-600">{state.errors.commission_pct}</p>
            )}
          </div>
          <button
            type="submit"
            disabled={pending}
            className="cursor-pointer rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 transition-colors"
          >
            {pending ? 'Zapisywanie...' : 'Zapisz'}
          </button>
          {state?.success && (
            <p className="text-sm text-green-600">Zapisano ✓</p>
          )}
        </form>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6">
        <h2 className="mb-4 font-semibold text-zinc-900">Przedmioty</h2>
        <div className="flex flex-col gap-2">
          {subjects.map((s) => (
            <SubjectRow key={s.id} subject={s} />
          ))}
        </div>
      </section>
    </div>
  )
}

function SubjectRow({ subject }: { subject: Subject }) {
  const [isPending, startTransition] = useTransition()

  return (
    <div className="flex items-center justify-between rounded-lg border border-zinc-100 px-4 py-3">
      <span className={`text-sm ${subject.is_active ? 'text-zinc-900' : 'text-zinc-400 line-through'}`}>
        {subject.label}
      </span>
      <button
        onClick={() =>
          startTransition(() => toggleSubjectActive(subject.id, !subject.is_active))
        }
        disabled={isPending}
        className={`cursor-pointer rounded-full px-3 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${
          subject.is_active
            ? 'bg-red-100 text-red-700 hover:bg-red-200'
            : 'bg-green-100 text-green-700 hover:bg-green-200'
        }`}
      >
        {isPending ? '...' : subject.is_active ? 'Dezaktywuj' : 'Aktywuj'}
      </button>
    </div>
  )
}
