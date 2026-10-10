'use client'
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react'

const ICONS = {
  success: [CheckCircle2, 'text-emerald-600'],
  error: [XCircle, 'text-red-600'],
  warning: [AlertTriangle, 'text-amber-600'],
  info: [Info, 'text-indigo-600'],
}

export default function Toast({ message, type = 'success', onClose }) {
  const [Icon, color] = ICONS[type] ?? ICONS.success
  return (
    <div role="status" className="pointer-events-auto flex w-[min(360px,calc(100vw-2rem))] items-start gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-lg">
      <Icon size={16} className={`${color} mt-0.5 shrink-0`} />
      <p className="flex-1 text-sm text-slate-800">{message}</p>
      <button onClick={onClose} aria-label="Dismiss" className="shrink-0 text-slate-400 hover:text-slate-700 transition-colors">
        <X size={14} />
      </button>
    </div>
  )
}
