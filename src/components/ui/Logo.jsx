// The PGBook mark: a simple building block, plus the word mark in the UI typeface.
export function LogoMark({ size = 24, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <rect width="24" height="24" rx="6" fill="currentColor" />
      <path d="M7 18V8.5L12 6l5 2.5V18" stroke="white" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M10 18v-3.5h4V18M10 10.5h.01M14 10.5h.01" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

export default function Logo({ inverted = false, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <LogoMark className={inverted ? 'text-white [&_path]:stroke-slate-900' : 'text-slate-900'} />
      <span className={`text-[15px] font-semibold tracking-tight ${inverted ? 'text-white' : 'text-slate-900'}`}>PGBook</span>
    </span>
  )
}
