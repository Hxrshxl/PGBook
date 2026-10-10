'use client'
import { Search } from 'lucide-react'

export default function SearchInput({ value, onChange, placeholder = 'Search…', label = 'Search', className = 'w-full sm:w-72' }) {
  return (
    <div className={`relative ${className}`}>
      <Search size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
      <input
        type="search"
        aria-label={label}
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="h-9 w-full rounded-md border border-slate-200 bg-white pl-8 pr-3 text-sm text-slate-900 placeholder:text-slate-400 shadow-xs focus:outline-none focus:border-indigo-500"
      />
    </div>
  )
}
