'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Check, RefreshCw } from 'lucide-react'
import { api, saveBlob } from '@/utils/api'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { useAsyncAction } from '@/hooks/useAsyncAction'
import { formatCurrency, formatDate } from '@/utils/helpers'
import { GST_STATES } from '@/utils/gst'
import Modal from '@/components/ui/Modal'
import FormError from '@/components/ui/FormError'
import Spinner from '@/components/ui/Spinner'
import ReasonDialog from '@/components/ui/ReasonDialog'
import Badge from '@/components/ui/Badge'
import PageHeader from '@/components/ui/PageHeader'
import Panel from '@/components/ui/Panel'
import { Segmented } from '@/components/ui/Tabs'
import { btn, button, page } from '@/components/ui/styles'

const inputCls = 'w-full border border-slate-200 rounded-md px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 transition-colors bg-white'
const labelCls = 'block text-[13px] font-medium text-slate-700 mb-1.5'
const day = d => (d ? formatDate(String(new Date(d).toISOString()).slice(0, 10)) : '—')

const STATUS_TONE = { trialing: 'blue', active: 'green', cancelling: 'amber', past_due: 'amber', trial_expired: 'red', unpaid: 'red', ended: 'red' }

function statusText(state) {
  switch (state.status) {
    case 'trialing': return `Free trial — ${state.daysLeft} day${state.daysLeft === 1 ? '' : 's'} left (ends ${day(state.trialEndsAt)}). Everything is included while you try PGBook.`
    case 'active': return state.currentPeriodEnd ? `${state.planLabel}, ${state.interval ?? 'monthly'}. Renews on ${day(state.currentPeriodEnd)}.` : `${state.planLabel} — active.`
    case 'cancelling': return `${state.planLabel} is cancelled and stays active until ${day(state.currentPeriodEnd)}. After that the account becomes read-only.`
    case 'past_due': return `The last payment failed. Razorpay retries automatically; fix your payment method before ${day(state.graceUntil)} to avoid read-only mode.`
    case 'trial_expired': return `Your free trial ended on ${day(state.trialEndsAt)}. The account is read-only: you can view and export everything. Choose a plan to make changes again.`
    case 'unpaid': return 'Payments stopped, so the account is read-only. Choose a plan to make changes again.'
    case 'ended': return 'Your subscription has ended, so the account is read-only. Choose a plan to make changes again.'
    default: return ''
  }
}

function Meter({ label, used, limit }) {
  const pct = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0
  return (
    <div>
      <p className="text-[13px] text-slate-500">{label}</p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums text-slate-900">{used}<span className="text-sm font-normal text-slate-400">{limit === null ? ' · unlimited' : limit === 0 ? ' · not included' : ` of ${limit}`}</span></p>
      {limit > 0 && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div className={`h-full rounded-full ${pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-indigo-500'}`} style={{ width: `${Math.max(2, pct)}%` }} />
        </div>
      )}
    </div>
  )
}

function DetailsForm({ details, onSaved }) {
  const [form, setForm] = useState(details)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const dirty = JSON.stringify(form) !== JSON.stringify(details)
  const { showToast } = useToast()
  const { run, busy, error } = useAsyncAction(async () => {
    onSaved(await api.put('/billing', form))
    showToast('Billing details saved.')
  })
  return (
    <form onSubmit={e => { e.preventDefault(); run() }} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="b-name" className={labelCls}>Business name on invoices</label>
          <input id="b-name" maxLength={120} value={form.legalName} onChange={e => set('legalName', e.target.value)} placeholder="Sunrise Hospitality" className={inputCls} />
        </div>
        <div>
          <label htmlFor="b-gstin" className={labelCls}>GSTIN <span className="text-slate-400 font-normal">(optional)</span></label>
          <input id="b-gstin" maxLength={15} value={form.gstin} onChange={e => set('gstin', e.target.value.toUpperCase())} placeholder="29ABCDE1234F1Z5" className={inputCls} />
        </div>
      </div>
      <div>
        <label htmlFor="b-address" className={labelCls}>Billing address</label>
        <input id="b-address" maxLength={300} value={form.address} onChange={e => set('address', e.target.value)} className={inputCls} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="b-state" className={labelCls}>State</label>
          <select id="b-state" value={form.stateCode} onChange={e => set('stateCode', e.target.value)} className={inputCls}>
            <option value="">Choose…</option>
            {GST_STATES.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="b-email" className={labelCls}>Invoice email</label>
          <input id="b-email" type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="Defaults to your login email" className={inputCls} />
        </div>
      </div>
      <FormError message={error} />
      <div className="flex justify-end">
        <button type="submit" disabled={!dirty || busy} className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap h-9 px-3.5 text-sm rounded-md bg-indigo-600 font-medium text-white shadow-xs transition-colors hover:bg-indigo-700 disabled:opacity-50">{busy ? 'Saving…' : 'Save details'}</button>
      </div>
    </form>
  )
}

function ExportDialog({ open, onClose }) {
  const [password, setPassword] = useState('')
  const { showToast } = useToast()
  const { run, busy, error, setError } = useAsyncAction(async () => {
    const { blob, filename } = await api.download('/export', { password })
    saveBlob(blob, filename)
    setPassword('')
    onClose()
    showToast('Your export is downloading.')
  })
  const close = () => { if (!busy) { setPassword(''); setError(''); onClose() } }
  return (
    <Modal isOpen={open} onClose={close} title="Export all data" maxWidth="max-w-md">
      <form onSubmit={e => { e.preventDefault(); run() }} className="space-y-4">
        <p className="text-sm text-slate-600">A ZIP of spreadsheets (CSV) with every property, tenant, due, payment, bill, expense, complaint and your activity log. It contains your tenants&apos; personal data — keep it safe.</p>
        <div>
          <label htmlFor="exp-pw" className={labelCls}>Confirm your password</label>
          <input id="exp-pw" type="password" required autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} className={inputCls} />
        </div>
        <FormError message={error} />
        <div className="flex justify-end gap-3">
          <button type="button" onClick={close} disabled={busy} className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap h-9 px-3.5 text-sm rounded-md border border-slate-200 bg-white font-medium text-slate-700 shadow-xs transition-colors hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50">Cancel</button>
          <button type="submit" disabled={busy || !password} className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap h-9 px-3.5 text-sm rounded-md bg-indigo-600 font-medium text-white shadow-xs transition-colors hover:bg-indigo-700 disabled:opacity-50">{busy ? 'Preparing…' : 'Download ZIP'}</button>
        </div>
      </form>
    </Modal>
  )
}

export default function BillingPage() {
  const { loadMe } = useAuth()
  const { showToast } = useToast()
  const [data, setData] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [period, setPeriod] = useState('monthly')
  const [cancelling, setCancelling] = useState(false)
  const [exporting, setExporting] = useState(false)

  const apply = useCallback(async next => {
    setData(next)
    await loadMe().catch(() => {}) // refresh read-only state and banners
  }, [loadMe])

  useEffect(() => {
    api.get('/billing').then(d => { setData(d); if (d.state.interval) setPeriod(d.state.interval) }).catch(e => setLoadError(e.message))
  }, [])

  const subscribe = useAsyncAction(async plan => {
    const { checkoutUrl } = await api.post('/billing/subscribe', { plan, interval: period })
    window.location.assign(checkoutUrl)
  })
  const sync = useAsyncAction(async () => {
    await apply(await api.post('/billing/sync'))
    showToast('Status refreshed.')
  })
  const mock = useAsyncAction(async outcome => {
    await apply(await api.post('/billing/mock', { outcome }))
    showToast('Test event applied.')
  })

  async function handleCancel({ reason }) {
    await apply(await api.post('/billing/cancel', { reason }))
    showToast('Subscription cancelled. It stays active until the end of the period.', 'warning')
    setCancelling(false)
    return true
  }

  if (!data) {
    return <div className="flex justify-center py-24">{loadError ? <div className="max-w-sm w-full px-4"><FormError message={loadError} /></div> : <Spinner size={26} />}</div>
  }

  const { state, usage, limits, plans, invoices, provider, subscription } = data
  const current = ['active', 'past_due', 'cancelling'].includes(state.status) ? state.plan : null
  const canCancel = ['active', 'past_due'].includes(state.status) && subscription.hasSubscription && subscription.provider !== 'manual'

  return (
    <div className={`${page} mx-auto max-w-4xl space-y-6`}>
      <PageHeader title="Subscription" description="Your PGBook plan, usage, invoices and data export." />

      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-5 py-4 sm:flex-row sm:items-center">
        <div className="flex-1">
          <Badge tone={STATUS_TONE[state.status] ?? 'gray'}>{state.statusLabel}</Badge>
          <p className="mt-2 text-sm text-slate-700">{statusText(state)}</p>
          {state.readOnly && state.retentionUntil && <p className="mt-1 text-xs text-slate-500">Your data is kept until {day(state.retentionUntil)}.</p>}
          {subscription.pending && (
            <p className="mt-1 text-xs text-slate-500">A checkout for {plans.find(p => p.id === subscription.pending.plan)?.label} ({subscription.pending.interval}) was started {day(subscription.pending.createdAt)}. Your plan changes as soon as the payment goes through.</p>
          )}
        </div>
        {(subscription.pending || state.status === 'past_due') && provider === 'razorpay' && (
          <button onClick={() => sync.run()} disabled={sync.busy} className={btn.secondary}>
            <RefreshCw size={14} className={sync.busy ? 'animate-spin' : ''} /> I&apos;ve paid, refresh
          </button>
        )}
      </div>

      <Panel title="Usage" description="Recording payments, receipts and exports never count against a limit." bodyClassName="grid grid-cols-1 gap-5 px-5 py-4 sm:grid-cols-3">
        <Meter label="Active tenants" used={usage.tenants} limit={limits.tenants} />
        <Meter label="Properties" used={usage.properties} limit={limits.properties} />
        <Meter label="Staff logins" used={usage.staff} limit={limits.staff} />
      </Panel>

      <Panel
        title={current ? 'Change plan' : 'Choose a plan'}
        actions={<Segmented label="Billing period" value={period} onChange={setPeriod} options={[{ key: 'monthly', label: 'Monthly' }, { key: 'yearly', label: 'Yearly · save 20%' }]} />}
        bodyClassName="p-5"
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {plans.map(p => {
            const isCurrent = current === p.id && (state.interval ?? 'monthly') === period
            const perMonth = period === 'yearly' ? p.yearlyMonthlyPrice : p.monthlyPrice
            return (
              <div key={p.id} className={`flex flex-col rounded-lg border p-4 ${isCurrent ? 'border-indigo-600 ring-1 ring-indigo-600' : 'border-slate-200'}`}>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900">{p.label}</p>
                  {isCurrent && <Badge tone="blue">Current</Badge>}
                </div>
                <p className="mt-2"><span className="text-2xl font-semibold tracking-tight tabular-nums text-slate-900">₹{perMonth}</span><span className="text-sm text-slate-500"> / month</span></p>
                <p className="text-xs text-slate-500">{period === 'yearly' ? `₹${(perMonth * 12).toLocaleString('en-IN')} billed yearly` : 'Billed monthly'} · GST included</p>
                <p className="mt-3 flex-1 text-[13px] leading-relaxed text-slate-600">{p.summary}</p>
                {p.blocker && !isCurrent && <p className="mt-2 text-xs text-amber-700">{p.blocker}</p>}
                <button
                  onClick={() => subscribe.run(p.id)}
                  disabled={isCurrent || !!p.blocker || subscribe.busy || !provider || (state.status === 'cancelling' && current === p.id)}
                  className={`mt-4 w-full ${isCurrent || p.blocker ? button('secondary') : button('primary')}`}
                >
                  {isCurrent ? <><Check size={14} /> Current plan</> : current ? `Switch to ${p.label}` : `Choose ${p.label}`}
                </button>
              </div>
            )
          })}
        </div>
        <FormError message={subscribe.error} />
        {!provider && <p className="mt-3 text-xs text-amber-700">Online payments are not set up on this server yet (Razorpay keys missing). Contact PGBook support to subscribe.</p>}
        {current && <p className="mt-3 text-xs text-slate-500">Switching starts the new plan as soon as its first payment succeeds; the old plan stops then. The unused part is not refunded.</p>}
      </Panel>

      {provider === 'mock' && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-5 py-4">
          <div className="flex items-center gap-2"><Badge tone="amber">Test mode</Badge><p className="text-sm font-medium text-slate-900">Local development</p></div>
          <p className="mt-1.5 text-xs text-slate-600">No real payments are taken. Simulate what Razorpay would report:</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {[['renew', 'Renewal succeeds'], ['renewal_failed', 'Renewal fails'], ['halt', 'All retries fail']].map(([outcome, label]) => (
              <button key={outcome} onClick={() => mock.run(outcome)} disabled={mock.busy || subscription.provider !== 'mock'} className={button('secondary', 'sm')}>{label}</button>
            ))}
          </div>
          <FormError message={mock.error} />
        </div>
      )}

      <Panel title="Invoices">
        {invoices.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-500">No invoices yet. They appear here after each payment.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                <th scope="col" className="py-2.5 pl-5 pr-3 font-medium">Invoice</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Date</th>
                <th scope="col" className="hidden px-3 py-2.5 font-medium sm:table-cell">Plan</th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">Amount</th>
                <th scope="col" className="py-2.5 pl-3 pr-5"><span className="sr-only">Open</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {invoices.map(i => (
                <tr key={i.id} className="hover:bg-slate-50/70">
                  <td className="py-2.5 pl-5 pr-3 font-medium text-slate-900">{i.number}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-slate-600">{day(i.issuedAt)}</td>
                  <td className="hidden px-3 py-2.5 text-slate-600 sm:table-cell">{plans.find(p => p.id === i.plan)?.label ?? i.plan}, {i.interval}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-slate-900">{formatCurrency(i.total)}</td>
                  <td className="py-2.5 pl-3 pr-5 text-right"><Link href={`/dashboard/billing/invoices/${i.id}`} className="text-[13px] font-medium text-slate-700 hover:text-slate-900 hover:underline">View</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>

      <Panel title="Billing details" description="Shown on your GST invoices." bodyClassName="p-5">
        <DetailsForm key={JSON.stringify(data.details)} details={data.details} onSaved={setData} />
      </Panel>

      <Panel bodyClassName="divide-y divide-slate-100">
        <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
          <div className="flex-1">
            <h2 className="text-sm font-medium text-slate-900">Export all data</h2>
            <p className="mt-0.5 text-xs text-slate-500">Everything as spreadsheets. Works even when the account is read-only.</p>
          </div>
          <button onClick={() => setExporting(true)} className={btn.secondary}>Export…</button>
        </div>
        {canCancel && (
          <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
            <div className="flex-1">
              <h2 className="text-sm font-medium text-slate-900">Cancel subscription</h2>
              <p className="mt-0.5 text-xs text-slate-500">You keep full access until {day(state.currentPeriodEnd)}. After that the account is read-only (view and export only) and your data is kept for 90 days.</p>
            </div>
            <button onClick={() => setCancelling(true)} className={`${btn.secondary} !text-red-600`}>Cancel subscription</button>
          </div>
        )}
      </Panel>

      <ExportDialog open={exporting} onClose={() => setExporting(false)} />
      <ReasonDialog
        isOpen={cancelling}
        title="Cancel subscription?"
        description={`It stays active until ${day(state.currentPeriodEnd)}, then the account becomes read-only. Your data is kept for 90 days and you can subscribe again any time.`}
        tone="danger"
        confirmLabel="Cancel subscription"
        reasonLabel="Why are you cancelling?"
        reasonHint="Helps us improve PGBook."
        onSubmit={handleCancel}
        onClose={() => setCancelling(false)}
      />
    </div>
  )
}
