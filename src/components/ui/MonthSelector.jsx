'use client'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { formatMonth, getPrevMonth, getNextMonth, getCurrentMonth } from '../../utils/helpers'

export default function MonthSelector({ value, onChange }) {
  const isMax = value >= getCurrentMonth()
  const arrow = 'inline-flex h-9 w-9 items-center justify-center text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-colors disabled:opacity-40 disabled:pointer-events-none'
  return (
    <div className="inline-flex items-center rounded-md border border-slate-200 bg-white shadow-xs">
      <button onClick={() => onChange(getPrevMonth(value))} aria-label="Previous month" className={`${arrow} rounded-l-md`}>
        <ChevronLeft size={16} />
      </button>
      <span className="min-w-[124px] border-x border-slate-200 px-3 text-center text-sm font-medium leading-9 text-slate-900">
        {formatMonth(value)}
      </span>
      <button onClick={() => !isMax && onChange(getNextMonth(value))} disabled={isMax} aria-label="Next month" className={`${arrow} rounded-r-md`}>
        <ChevronRight size={16} />
      </button>
    </div>
  )
}
