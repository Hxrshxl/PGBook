import Link from 'next/link'
import Logo from '@/components/ui/Logo'
import { button } from '@/components/ui/styles'

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="px-6 py-5">
        <Link href="/" aria-label="PGBook home" className="inline-flex"><Logo /></Link>
      </header>
      <main className="flex flex-1 items-start justify-center px-6 pt-[14vh]">
        <div className="max-w-md">
          <p className="text-sm font-medium tabular-nums text-slate-500">404</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">This page doesn&apos;t exist</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">The link may be old, or the page may have moved. Check the address, or go back to where you started.</p>
          <div className="mt-6 flex gap-2">
            <Link href="/dashboard" className={button('primary')}>Go to dashboard</Link>
            <Link href="/" className={button('secondary')}>Home page</Link>
          </div>
        </div>
      </main>
    </div>
  )
}
