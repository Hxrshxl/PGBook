'use client'
const variants = {
  paid:          'bg-emerald-50 text-emerald-700 border-emerald-200',
  pending:       'bg-amber-50   text-amber-700   border-amber-200',
  partial:       'bg-blue-50    text-blue-700    border-blue-200',
  open:          'bg-red-50     text-red-700     border-red-200',
  'in-progress': 'bg-purple-50  text-purple-700  border-purple-200',
  resolved:      'bg-slate-50   text-slate-600   border-slate-200',
  active:        'bg-emerald-50 text-emerald-700 border-emerald-200',
  vacated:       'bg-slate-100  text-slate-500   border-slate-200',
  high:          'bg-red-50     text-red-700     border-red-200',
  medium:        'bg-amber-50   text-amber-700   border-amber-200',
  low:           'bg-slate-50   text-slate-600   border-slate-200',
}

const LABELS = { 'in-progress': 'In Progress' }

export default function Badge({ status, className = '' }) {
  const cls = variants[status] ?? 'bg-slate-100 text-slate-600 border-slate-200'
  const label = LABELS[status] ?? (status ? status.charAt(0).toUpperCase() + status.slice(1) : '')
  return (
    <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full border ${cls} ${className}`}>
      {label}
    </span>
  )
}
