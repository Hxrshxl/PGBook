'use client'

// Rounds a maximum up to a readable step × a power of ten, so the gridlines land on round values.
function niceMax(v) {
  if (v <= 0) return 1
  const mag = 10 ** Math.floor(Math.log10(v))
  return [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].map(m => m * mag).find(n => n >= v)
}

/**
 * Simple column chart with two gridlines and a value tooltip per bar.
 * The last bar is drawn darker when `highlightLast` (usually "this month").
 */
export default function BarChart({ data, formatValue = v => v, formatAxis = v => v, highlightLast = false, height = 160 }) {
  const max = niceMax(Math.max(...data.map(d => d.value), 0))
  return (
    <div>
      <div className="relative" style={{ height }}>
        {[1, 0.5, 0].map(f => (
          <div key={f} className="absolute inset-x-0 flex items-center gap-3" style={{ bottom: `${f * 100}%`, transform: 'translateY(50%)' }}>
            <span className="w-12 shrink-0 text-right text-[11px] tabular-nums text-slate-400">{formatAxis(max * f)}</span>
            <div className={`h-px flex-1 ${f ? 'bg-slate-100' : 'bg-slate-200'}`} />
          </div>
        ))}
        <div className="absolute inset-y-0 left-[60px] right-0 flex items-end gap-1.5 sm:gap-3">
          {data.map(({ label, value }, i) => {
            const strong = highlightLast ? i === data.length - 1 : true
            return (
              <div key={label} className="group relative flex h-full flex-1 items-end justify-center">
                <div className="pointer-events-none absolute left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-xs font-medium text-white opacity-0 transition-opacity group-hover:opacity-100"
                  style={{ bottom: `calc(${(value / max) * 100}% + 6px)` }}>
                  {formatValue(value)}
                </div>
                <div
                  className={`w-full max-w-10 rounded-t-[3px] transition-colors ${strong ? 'bg-indigo-500 group-hover:bg-indigo-600' : 'bg-indigo-200 group-hover:bg-indigo-300'}`}
                  style={{ height: `${value > 0 ? Math.max((value / max) * 100, 1.5) : 0}%` }}
                />
              </div>
            )
          })}
        </div>
      </div>
      <div className="ml-[60px] mt-2 flex gap-1.5 sm:gap-3">
        {data.map(({ label }) => <p key={label} className="flex-1 truncate text-center text-[11px] text-slate-500">{label}</p>)}
      </div>
    </div>
  )
}
