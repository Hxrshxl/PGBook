'use client'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { formatMonth, getPrevMonth, getNextMonth, getCurrentMonth } from '../../utils/helpers'

export default function MonthSelector({ value, onChange }) {
  const isMax = value >= getCurrentMonth()

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => onChange(getPrevMonth(value))}
        className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-700 hover:border-slate-300 transition-colors"
      >
        <ChevronLeft size={16} />
      </button>
      <span
        className="text-slate-900 font-semibold text-sm min-w-[130px] text-center"
        style={{ fontFamily: 'Space Grotesk' }}
      >
        {formatMonth(value)}
      </span>
      <button
        onClick={() => !isMax && onChange(getNextMonth(value))}
        disabled={isMax}
        className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-700 hover:border-slate-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  )
}
