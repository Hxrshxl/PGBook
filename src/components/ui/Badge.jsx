'use client'

// Status labels: a small tinted tag with a dot. Colour carries meaning, never decoration.
const TONES = {
  green:  ['bg-emerald-50 text-emerald-700', 'bg-emerald-500'],
  amber:  ['bg-amber-50 text-amber-800', 'bg-amber-500'],
  blue:   ['bg-indigo-50 text-indigo-700', 'bg-indigo-500'],
  red:    ['bg-red-50 text-red-700', 'bg-red-500'],
  gray:   ['bg-slate-100 text-slate-600', 'bg-slate-400'],
}

const STATUS_TONE = {
  paid: 'green', active: 'green', resolved: 'green', approved: 'green', confirmed: 'green', accepted: 'green', acknowledged: 'green', closed: 'gray',
  pending: 'amber', medium: 'amber', past_due: 'amber', disputed: 'red',
  partial: 'blue', 'in-progress': 'blue', shared: 'blue',
  open: 'red', high: 'red', rejected: 'red', declined: 'red', failed: 'red',
  vacated: 'gray', low: 'gray', cancelled: 'gray', withdrawn: 'gray', expired: 'gray', draft: 'gray',
}

const LABELS = { 'in-progress': 'In progress', past_due: 'Past due' }

export default function Badge({ status, tone, children, className = '' }) {
  const [cls, dot] = TONES[tone ?? STATUS_TONE[status] ?? 'gray']
  const label = children ?? LABELS[status] ?? (status ? status.charAt(0).toUpperCase() + status.slice(1) : '')
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-xs font-medium whitespace-nowrap ${cls} ${className}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} aria-hidden="true" />
      {label}
    </span>
  )
}
