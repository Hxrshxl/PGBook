'use client'

/** Page-level filter tabs: text with an underline for the selected one. tabs: [{ key, label, count? }] */
export default function Tabs({ tabs, value, onChange, className = '' }) {
  return (
    <div role="tablist" className={`flex flex-wrap gap-x-5 border-b border-slate-200 ${className}`}>
      {tabs.map(t => {
        const active = t.key === value
        return (
          <button
            key={t.key}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.key)}
            className={`-mb-px flex shrink-0 items-center gap-1.5 border-b-2 pb-2.5 pt-1 text-sm transition-colors ${active ? 'border-indigo-600 font-medium text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
          >
            {t.label}
            {t.count !== undefined && (
              <span className={`rounded px-1.5 text-xs tabular-nums ${active ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'}`}>{t.count}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}

/** A compact segmented control for small option sets (e.g. monthly / yearly). */
export function Segmented({ options, value, onChange, label }) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-md border border-slate-200 bg-slate-50 p-0.5">
      {options.map(o => (
        <button
          key={o.key}
          onClick={() => onChange(o.key)}
          aria-pressed={o.key === value}
          className={`h-7 rounded px-2.5 text-[13px] font-medium transition-colors ${o.key === value ? 'bg-white text-slate-900 shadow-xs ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-800'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
