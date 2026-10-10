'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Badge from '@/components/ui/Badge'
import { button } from '@/components/ui/styles'
import { api } from '@/utils/api'
import { useAuth } from '@/context/AuthContext'
import { useAsyncAction } from '@/hooks/useAsyncAction'
import FormError from '@/components/ui/FormError'
import Spinner from '@/components/ui/Spinner'

// Test-mode checkout used in local development instead of Razorpay's payment page.
export default function MockCheckoutPage() {
  const router = useRouter()
  const { loadMe } = useAuth()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => { api.get('/billing').then(setData).catch(e => setError(e.message)) }, [])

  const { run, busy, error: actionError } = useAsyncAction(async outcome => {
    await api.post('/billing/mock', { outcome })
    await loadMe().catch(() => {})
    router.replace('/dashboard/billing')
  })

  if (error) return <div className="p-8 max-w-md mx-auto"><FormError message={error} /></div>
  if (!data) return <div className="flex justify-center py-24"><Spinner size={26} /></div>
  const pending = data.subscription.pending
  const plan = data.plans.find(p => p.id === pending?.plan)
  const amount = plan ? (pending.interval === 'yearly' ? plan.yearlyMonthlyPrice * 12 : plan.monthlyPrice) : 0

  return (
    <div className="mx-auto max-w-md px-4 py-8 sm:py-12">
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <Badge tone="amber">Test checkout</Badge>
        {data.provider !== 'mock' || !pending ? (
          <p className="text-sm text-slate-600 mt-3">There is no test checkout waiting. <button onClick={() => router.replace('/dashboard/billing')} className="font-medium text-slate-900 underline underline-offset-2">Back to Subscription</button></p>
        ) : (
          <>
            <h1 className="text-xl font-semibold text-slate-900 mt-2">{plan?.label} · {pending.interval}</h1>
            <p className="mt-3 text-3xl font-semibold tracking-tight tabular-nums text-slate-900">₹{amount.toLocaleString('en-IN')}</p>
            <p className="text-xs text-slate-500">GST included. This is a simulation; no money moves.</p>
            <FormError message={actionError} />
            <div className="flex flex-col gap-2 mt-6">
              <button onClick={() => run('pay')} disabled={busy} className={`${button('primary', 'lg')} w-full`}>Pay ₹{amount.toLocaleString('en-IN')} (test)</button>
              <button onClick={() => run('abandon')} disabled={busy} className={`${button('secondary', 'lg')} w-full`}>Cancel checkout</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
