import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { button } from '@/components/ui/styles'

export default function CTA() {
  return (
    <section className="bg-slate-900">
      <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-8 px-5 py-16 sm:px-8 md:flex-row md:items-center">
        <div className="max-w-xl">
          <h2 className="text-3xl font-semibold tracking-tight text-white">Try it with this month’s rent</h2>
          <p className="mt-3 text-slate-300">Add your PG and tenants tonight, and know who has paid by tomorrow. Free for 14 days.</p>
        </div>
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <Link href="/signup" className={`${button('secondary', 'lg')} !border-white !bg-white !text-slate-900 hover:!bg-slate-100`}>Start free trial <ArrowRight size={16} /></Link>
          <Link href="/login" className={`${button('ghost', 'lg')} !text-slate-300 hover:bg-white/10 hover:!text-white`}>Sign in</Link>
        </div>
      </div>
    </section>
  )
}
