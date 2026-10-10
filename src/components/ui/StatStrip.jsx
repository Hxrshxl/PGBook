'use client'

const TONES = {
  default: 'text-slate-900',
  positive: 'text-emerald-700',
  warning: 'text-amber-700',
  negative: 'text-red-600',
  muted: 'text-slate-500',
}

const COLS = { 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-3', 4: 'sm:grid-cols-2 lg:grid-cols-4', 5: 'sm:grid-cols-3 lg:grid-cols-5' }

/**
 * A row of key figures in one bordered panel, separated by hairlines
 * (the 1px gap shows the panel's border colour through).
 * items: [{ label, value, sub?, tone? }]
 */
export default function StatStrip({ items, className = '' }) {
  const odd = items.length % 2 === 1
  return (
    <div className={`grid grid-cols-2 ${COLS[items.length] ?? COLS[4]} gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200 ${className}`}>
      {items.map((item, i) => (
        <div key={item.label} className={`bg-white px-4 py-3 lg:px-5 lg:py-4${odd && i === items.length - 1 ? 'col-span-2 sm:col-span-1' : ''}`}>
          <p className="text-[13px] text-slate-500">{item.label}</p>
          <p className={`mt-1 text-xl font-semibold tracking-tight tabular-nums ${TONES[item.tone] ?? TONES.default}`}>{item.value}</p>
          {item.sub && <p className="mt-0.5 truncate text-xs text-slate-500">{item.sub}</p>}
        </div>
      ))}
    </div>
  )
}
