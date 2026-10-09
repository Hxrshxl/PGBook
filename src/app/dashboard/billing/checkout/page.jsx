'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FlaskConical } from 'lucide-react'
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
    <div className="p-4 sm:p-8 max-w-md mx-auto">
      <div className="bg-white rounded-2xl border border-violet-200 shadow-sm p-6">
        <p className="text-xs font-semibold text-violet-700 uppercase tracking-wide flex items-center gap-1.5"><FlaskConical size={13} /> Test checkout</p>
        {data.provider !== 'mock' || !pending ? (
          <p className="text-sm text-slate-600 mt-3">There is no test checkout waiting. <button onClick={() => router.replace('/dashboard/billing')} className="text-indigo-600 font-medium">Back to Subscription</button></p>
        ) : (
          <>
            <h1 className="text-xl font-bold text-slate-900 mt-2">{plan?.label} · {pending.interval}</h1>
            <p className="text-3xl font-bold text-slate-900 mt-3">₹{amount.toLocaleString('en-IN')}</p>
            <p className="text-xs text-slate-400">GST included. This is a simulation — no money moves.</p>
            <FormError message={actionError} />
            <div className="flex flex-col gap-2 mt-6">
              <button onClick={() => run('pay')} disabled={busy} className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm disabled:opacity-60">Pay ₹{amount.toLocaleString('en-IN')} (test)</button>
              <button onClick={() => run('abandon')} disabled={busy} className="w-full py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:border-slate-300 disabled:opacity-60">Cancel checkout</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
