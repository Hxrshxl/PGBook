'use client'
import Link from 'next/link'
import { AlertCircle } from 'lucide-react'
import Logo from './Logo'

/** Layout for sign-in style pages: logo, a narrow form column, and a quiet footer. */
export default function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="px-6 py-5">
        <Link href="/" aria-label="PGBook home" className="inline-flex"><Logo /></Link>
      </header>
      <main className="flex flex-1 items-start justify-center px-6 pb-16 pt-[8vh]">
        <div className="w-full max-w-[380px]">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
          {subtitle && <p className="mt-1.5 text-sm text-slate-500">{subtitle}</p>}
          <div className="mt-8">{children}</div>
          {footer && <div className="mt-8 text-sm text-slate-500">{footer}</div>}
        </div>
      </main>
      <footer className="px-6 py-5 text-xs text-slate-400">© PGBook · <a href="mailto:hello@pgbook.in" className="hover:text-slate-600">hello@pgbook.in</a></footer>
    </div>
  )
}

export function AuthError({ message }) {
  if (!message) return null
  return (
    <div role="alert" className="mb-5 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
      <AlertCircle size={15} className="mt-0.5 shrink-0" />
      <p>{message}</p>
    </div>
  )
}
