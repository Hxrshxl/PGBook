'use client'
const STYLES = {
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  suspended: 'bg-rose-50 text-rose-700 border-rose-200',
  disabled: 'bg-slate-100 text-slate-500 border-slate-200',
  invited: 'bg-sky-50 text-sky-700 border-sky-200',
  trial: 'bg-amber-50 text-amber-800 border-amber-200',
  expired: 'bg-rose-50 text-rose-700 border-rose-200',
  paid: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  pending: 'bg-amber-50 text-amber-800 border-amber-200',
  approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  rejected: 'bg-rose-50 text-rose-700 border-rose-200',
  cancelled: 'bg-slate-100 text-slate-500 border-slate-200',
  failed: 'bg-rose-50 text-rose-700 border-rose-200',
  admin: 'bg-rose-50 text-rose-700 border-rose-200',
  org: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  system: 'bg-slate-100 text-slate-600 border-slate-200',
  resident: 'bg-teal-50 text-teal-700 border-teal-200',
  neutral: 'bg-slate-50 text-slate-600 border-slate-200',
}

export default function Pill({ tone = 'neutral', children, title }) {
  return (
    <span title={title} className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full border whitespace-nowrap ${STYLES[tone] ?? STYLES.neutral}`}>
      {children}
    </span>
  )
}
