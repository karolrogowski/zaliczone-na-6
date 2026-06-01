import type { StudentStats } from '../types'

const BAR_COLORS = ['#185FA5', '#5E94C2', '#8EB4D2', '#B8CDE0']

export function StudentStatsSection({ stats }: { stats: StudentStats }) {
  return (
    <div className="bg-white border border-[#e8e6de] rounded-[12px] overflow-hidden">
      <div className="flex items-center justify-between px-4 pt-[14px] pb-[10px]">
        <h3 className="text-[13px] font-medium text-[#2c2c2a]">Twoje statystyki</h3>
        <span className="text-[11px] text-[#888780]">od początku</span>
      </div>

      <div className="px-4 pb-4">
        <div className="flex items-baseline gap-2 py-[10px] mb-[14px] border-b border-[#e8e6de]">
          <span
            className="text-[28px] font-medium leading-none tabular-nums"
            style={{ color: stats.totalCompleted === 0 ? '#888780' : '#2c2c2a' }}
          >
            {stats.totalCompleted}
          </span>
          <span className="text-[11px] text-[#888780]">ukończonych sesji</span>
        </div>

        {stats.totalCompleted === 0 ? (
          <p className="text-[12px] text-[#888780] leading-[1.6] text-center py-4">
            Brak sesji w tym miesiącu.<br />
            Statystyki pojawią się po pierwszej sesji.
          </p>
        ) : (
          <div className="flex flex-col gap-[10px]">
            {stats.subjectsBreakdown.map((s, i) => (
              <div key={s.subject_id} className="flex items-center gap-[10px] text-[11px]">
                <span className="w-[78px] text-[#5f5e5a] shrink-0 truncate">{s.label}</span>
                <div className="flex-1 h-[6px] rounded-[3px] overflow-hidden" style={{ backgroundColor: '#f5f5f3' }}>
                  <div
                    className="h-full rounded-[3px] transition-all"
                    style={{
                      width: `${Math.round((s.count / stats.totalCompleted) * 100)}%`,
                      backgroundColor: BAR_COLORS[i] ?? BAR_COLORS[BAR_COLORS.length - 1],
                    }}
                  />
                </div>
                <span className="w-[18px] text-right font-medium text-[#2c2c2a] tabular-nums shrink-0">
                  {s.count}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
