'use client'
export default function EmptyState({ icon: Icon, title, message, actionLabel, onAction }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {Icon && (
        <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
          <Icon size={24} className="text-slate-400" />
        </div>
      )}
      <h3 className="text-slate-900 font-semibold text-base mb-1">{title}</h3>
      {message && <p className="text-slate-500 text-sm max-w-xs">{message}</p>}
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="mt-5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm px-5 py-2.5 rounded-xl transition-colors"
        >
          {actionLabel}
        </button>
      )}
    </div>
  )
}
