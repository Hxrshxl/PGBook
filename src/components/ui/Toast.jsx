'use client'
import { CheckCircle2, XCircle, AlertCircle, X } from 'lucide-react'

const ICONS = { success: CheckCircle2, error: XCircle, warning: AlertCircle, info: AlertCircle }
const COLORS = {
  success: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  error:   'bg-red-50    border-red-200    text-red-800',
  warning: 'bg-amber-50  border-amber-200  text-amber-800',
  info:    'bg-blue-50   border-blue-200   text-blue-800',
}
const ICON_COLORS = {
  success: 'text-emerald-500',
  error:   'text-red-500',
  warning: 'text-amber-500',
  info:    'text-blue-500',
}

export default function Toast({ message, type = 'success', onClose }) {
  const Icon = ICONS[type] ?? CheckCircle2
  return (
    <div className={`flex items-start gap-3 min-w-[260px] max-w-sm px-4 py-3 rounded-xl border shadow-lg ${COLORS[type]}`}>
      <Icon size={16} className={`${ICON_COLORS[type]} flex-shrink-0 mt-0.5`} />
      <p className="text-sm font-medium flex-1">{message}</p>
      <button onClick={onClose} className="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity">
        <X size={14} />
      </button>
    </div>
  )
}
