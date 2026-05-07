import { LEVEL_OPTIONS } from '../options'
import type { TutorPublicProfile } from '../types'

function Stars({ avg, count }: { avg: number | null; count: number }) {
  if (!avg || count === 0) {
    return <span className="text-sm text-zinc-400">Brak ocen</span>
  }
  const full = Math.floor(avg)
  const half = avg - full >= 0.5
  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((i) => (
          <span
            key={i}
            className={`text-xl ${i <= full ? 'text-yellow-400' : i === full + 1 && half ? 'text-yellow-200' : 'text-zinc-200'}`}
          >
            ★
          </span>
        ))}
      </div>
      <span className="text-sm font-semibold text-zinc-700">{avg.toFixed(1)}</span>
      <span className="text-sm text-zinc-400">
        ({count} {count === 1 ? 'ocena' : count < 5 ? 'oceny' : 'ocen'})
      </span>
    </div>
  )
}

function levelLabel(code: string): string {
  return LEVEL_OPTIONS.find((o) => o.value === code)?.label ?? code
}

export function TutorPublicProfileView({ profile }: { profile: TutorPublicProfile }) {
  const name = profile.profiles?.full_name ?? 'Korepetytor'
  const rateFormatted =
    profile.hourly_rate_grosz != null
      ? `${(profile.hourly_rate_grosz / 100).toFixed(0)} PLN/h`
      : 'Stawka do ustalenia'

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-2xl border border-zinc-200 bg-white p-6">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-zinc-900">{name}</h1>
            <p className="mt-0.5 text-sm font-medium text-zinc-500">{rateFormatted}</p>
          </div>
          <span
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${
              profile.is_available
                ? 'bg-green-100 text-green-800'
                : 'bg-zinc-100 text-zinc-500'
            }`}
          >
            {profile.is_available ? 'Dostępny teraz' : 'Niedostępny'}
          </span>
        </div>

        <Stars avg={profile.rating_avg} count={profile.rating_count} />

        {profile.bio && (
          <p className="mt-4 text-sm text-zinc-600 leading-relaxed">{profile.bio}</p>
        )}
      </div>

      {profile.tutor_subjects.length > 0 && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-5">
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-zinc-400">
            Przedmioty
          </p>
          <div className="flex flex-wrap gap-2">
            {profile.tutor_subjects.map((ts) => (
              <span
                key={ts.subject_id}
                className="rounded-full bg-zinc-100 px-3 py-1 text-sm text-zinc-700"
              >
                {ts.subjects?.label ?? ts.subject_id}
              </span>
            ))}
          </div>
        </div>
      )}

      {profile.levels?.length > 0 && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-5">
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-zinc-400">
            Poziomy nauczania
          </p>
          <div className="flex flex-wrap gap-2">
            {profile.levels.map((code) => (
              <span
                key={code}
                className="rounded-full bg-zinc-100 px-3 py-1 text-sm text-zinc-700"
              >
                {levelLabel(code)}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
