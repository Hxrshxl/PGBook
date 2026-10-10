// Shared class strings, so buttons and fields look the same on every screen.
// Prefer these over hand-written Tailwind strings in new code.

const base = 'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none'

const SIZES = {
  xs: 'h-7 px-2 text-xs',
  sm: 'h-8 px-2.5 text-[13px]',
  md: 'h-9 px-3.5 text-sm',
  lg: 'h-10 px-4 text-sm',
}

const VARIANTS = {
  primary: 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-xs',
  secondary: 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 shadow-xs',
  ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
  danger: 'bg-red-600 text-white hover:bg-red-700 shadow-xs',
  dangerGhost: 'text-red-600 hover:bg-red-50',
}

/** A button class for any variant and size, e.g. button('secondary', 'sm'). */
export const button = (variant = 'secondary', size = 'md') => `${base} ${SIZES[size]} ${VARIANTS[variant]}`

export const btn = {
  primary: button('primary'),
  secondary: button('secondary'),
  ghost: button('ghost'),
  danger: button('danger'),
  dangerGhost: button('dangerGhost'),
  icon: `${base} h-8 w-8 text-slate-500 hover:bg-slate-100 hover:text-slate-900`,
}

export const field = {
  label: 'block text-[13px] font-medium text-slate-700 mb-1.5',
  input: 'w-full h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 shadow-xs transition-colors focus:outline-none focus:border-indigo-500 disabled:bg-slate-50 disabled:text-slate-500',
  textarea: 'w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 shadow-xs transition-colors focus:outline-none focus:border-indigo-500 resize-none',
  help: 'text-xs text-slate-500 mt-1.5',
}

export const surface = {
  card: 'bg-white border border-slate-200 rounded-xl',
  header: 'flex items-center justify-between gap-3 px-5 py-3.5 border-b border-slate-200',
  title: 'text-sm font-semibold text-slate-900',
}

export const page = 'px-4 py-6 sm:px-6 lg:px-8 lg:py-8'
