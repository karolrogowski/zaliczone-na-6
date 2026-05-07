import type { StudentStats } from '../types'

export function StudentStatsSection({
  stats,
  hasActiveRequest,
}: {
  stats: StudentStats
  hasActiveRequest: boolean
}) {
  if (stats.totalCompleted === 0) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-6">
        <h2 className="mb-1 text-lg font-semibold text-zinc-900">Witaj!</h2>
        <p className="mb-5 text-sm text-zinc-500">
          Nie odbyłeś jeszcze żadnej konsultacji. Złóż pierwsze zlecenie i znajdź korepetytora
          w kilka minut.
        </p>
        {!hasActiveRequest && (
          <a
            href="/request"
            className="inline-block rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-700 transition-colors"
          >
            Złóż pierwsze zlecenie →
          </a>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5">
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-400">
            Ukończone sesje
          </p>
          <p className="text-3xl font-bold text-zinc-900">{stats.totalCompleted}</p>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-5">
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-400">
            Korepetytorzy
          </p>
          <p className="text-3xl font-bold text-zinc-900">{stats.uniqueTutors}</p>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-5 col-span-2 sm:col-span-1">
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-400">
            Przedmioty
          </p>
          <p className="text-3xl font-bold text-zinc-900">{stats.subjectsBreakdown.length}</p>
        </div>
      </div>

      {stats.subjectsBreakdown.length > 0 && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-5">
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-zinc-400">
            Sesje według przedmiotu
          </p>
          <div className="flex flex-col gap-2">
            {stats.subjectsBreakdown.map((s) => (
              <div key={s.subject_id} className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="mb-0.5 flex items-center justify-between">
                    <span className="text-sm text-zinc-700">{s.label}</span>
                    <span className="text-xs font-semibold text-zinc-500">
                      {s.count} {s.count === 1 ? 'sesja' : s.count < 5 ? 'sesje' : 'sesji'}
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
                    <div
                      className="h-full rounded-full bg-zinc-900 transition-all"
                      style={{
                        width: `${Math.round((s.count / stats.totalCompleted) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!hasActiveRequest && (
        <a
          href="/request"
          className="inline-flex items-center justify-center rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-700 transition-colors"
        >
          Złóż nowe zlecenie →
        </a>
      )}
    </div>
  )
}
