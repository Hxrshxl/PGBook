'use client'
import { btn } from './styles'

export default function EmptyState({ icon: Icon, title, message, actionLabel, onAction }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
      {Icon && (
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-500">
          <Icon size={18} strokeWidth={1.75} />
        </div>
      )}
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      {message && <p className="mt-1 max-w-sm text-sm text-slate-500">{message}</p>}
      {actionLabel && onAction && (
        <button onClick={onAction} className={`${btn.primary} mt-5`}>{actionLabel}</button>
      )}
    </div>
  )
}
