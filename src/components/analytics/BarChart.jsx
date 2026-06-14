'use client'
export default function BarChart({ data, color = 'bg-indigo-500', formatValue = v => v, maxOverride }) {
  const max = maxOverride ?? Math.max(...data.map(d => d.value), 1)
  return (
    <div className="flex items-end gap-2 h-40">
      {data.map(({ label, value }) => {
        const pct = max > 0 ? (value / max) * 100 : 0
        return (
          <div key={label} className="flex-1 flex flex-col items-center gap-1 group relative">
            {/* Tooltip */}
            <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-xs font-medium px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
              {formatValue(value)}
            </div>
            <div className="w-full flex items-end" style={{ height: '128px' }}>
              <div
                className={`w-full rounded-t-lg transition-all duration-500 ${color} ${value === 0 ? 'opacity-20' : 'opacity-90 hover:opacity-100'}`}
                style={{ height: `${Math.max(pct, value > 0 ? 4 : 0)}%` }}
              />
            </div>
            <p className="text-slate-400 text-xs truncate w-full text-center">{label}</p>
          </div>
        )
      })}
    </div>
  )
}
