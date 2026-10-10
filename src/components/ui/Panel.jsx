'use client'

/** A bordered section with a title row. Use for lists and grouped content inside a page. */
export default function Panel({ title, description, count, actions, children, className = '', bodyClassName = '' }) {
  return (
    <section className={`overflow-hidden rounded-xl border border-slate-200 bg-white ${className}`}>
      {(title || actions) && (
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-3">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              {title}
              {count > 0 && <span className="rounded bg-slate-100 px-1.5 text-xs font-medium tabular-nums text-slate-600">{count}</span>}
            </h2>
            {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  )
}
