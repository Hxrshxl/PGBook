'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Check } from 'lucide-react'
import { PLANS, TRIAL_DAYS } from '@/lib/plans'
import { Segmented } from '@/components/ui/Tabs'
import { button } from '@/components/ui/styles'

const TIERS = [
  { id: 'starter', limits: ['Up to 10 tenants', '1 property', 'Owner login only'] },
  { id: 'pro', limits: ['Up to 50 tenants', '1 property', '3 staff logins'], recommended: true },
  { id: 'multi', limits: ['Unlimited tenants', 'Up to 5 properties', '10 staff logins'] },
]

const INCLUDED = [
  'Rent tracking, part payments and late fees',
  'Tenant app with phone login and UPI',
  'Utility bill splitting',
  'WhatsApp reminders and receipts',
  'Complaints, notices and move-outs',
  'Deposits and settlements',
  'Expenses, profit and analytics',
  'Full data export, any time',
]

export default function Pricing() {
  const [period, setPeriod] = useState('monthly')
  const yearly = period === 'yearly'

  return (
    <section id="pricing" className="scroll-mt-16 border-b border-slate-200 bg-white py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">Simple pricing, every feature included</h2>
            <p className="mt-4 text-lg text-slate-600">Plans differ only in how many tenants, properties and staff you have. Prices include GST.</p>
          </div>
          <Segmented label="Billing period" value={period} onChange={setPeriod} options={[{ key: 'monthly', label: 'Monthly' }, { key: 'yearly', label: 'Yearly · save 20%' }]} />
        </div>

        <div className="mt-12 grid gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200 md:grid-cols-3">
          {TIERS.map(t => {
            const plan = PLANS[t.id]
            const price = yearly ? plan.yearlyMonthlyPrice : plan.monthlyPrice
            return (
              <div key={t.id} className="flex flex-col bg-white p-6 sm:p-8">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-[15px] font-semibold text-slate-900">{plan.label}</h3>
                  {t.recommended && <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">Most PGs pick this</span>}
                </div>
                <p className="mt-1 text-sm text-slate-500">{plan.blurb}</p>
                <p className="mt-6">
                  <span className="text-4xl font-semibold tracking-tight tabular-nums text-slate-900">₹{price}</span>
                  <span className="text-sm text-slate-500"> / month</span>
                </p>
                <p className="mt-1 text-xs text-slate-500">{yearly ? `₹${(price * 12).toLocaleString('en-IN')} billed once a year` : 'Billed monthly, cancel any time'}</p>
                <Link href="/signup" className={`mt-6 ${button(t.recommended ? 'primary' : 'secondary', 'lg')}`}>Start free trial</Link>
                <ul className="mt-6 space-y-2.5 border-t border-slate-100 pt-6">
                  {t.limits.map(l => (
                    <li key={l} className="flex gap-2.5 text-sm text-slate-700"><Check size={16} className="mt-0.5 shrink-0 text-slate-900" />{l}</li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>

        <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_2fr]">
          <div>
            <h3 className="text-[15px] font-semibold text-slate-900">Included in every plan</h3>
            <p className="mt-1 text-sm text-slate-500">{TRIAL_DAYS}-day free trial with everything switched on. No card needed.</p>
          </div>
          <ul className="grid gap-x-8 gap-y-2.5 sm:grid-cols-2">
            {INCLUDED.map(f => (
              <li key={f} className="flex gap-2.5 text-sm text-slate-700"><Check size={16} className="mt-0.5 shrink-0 text-indigo-600" />{f}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
