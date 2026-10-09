'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Check, CreditCard, Download, FileText, RefreshCw, ShieldAlert, FlaskConical } from 'lucide-react'
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

const inputCls = 'w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition-colors'
const labelCls = 'block text-slate-700 text-sm font-medium mb-1.5'
const cardCls = 'bg-white rounded-2xl border border-slate-100 shadow-sm'
const day = d => (d ? formatDate(String(new Date(d).toISOString()).slice(0, 10)) : '—')

const TONES = {
  trialing: 'bg-indigo-50 border-indigo-100 text-indigo-900',
  active: 'bg-emerald-50 border-emerald-100 text-emerald-900',
  cancelling: 'bg-amber-50 border-amber-100 text-amber-900',
  past_due: 'bg-amber-50 border-amber-200 text-amber-900',
  trial_expired: 'bg-red-50 border-red-200 text-red-900',
  unpaid: 'bg-red-50 border-red-200 text-red-900',
  ended: 'bg-red-50 border-red-200 text-red-900',
}

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
      <div className="flex justify-between text-sm mb-1">
        <span className="text-slate-600">{label}</span>
        <span className="font-medium text-slate-900 tabular-nums">{used}{limit === null ? '' : ` / ${limit}`}</span>
      </div>
      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
        <div className={`h-full rounded-full ${limit === null ? 'bg-emerald-400' : pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-indigo-500'}`} style={{ width: `${limit === null ? 15 : Math.max(2, pct)}%` }} />
      </div>
      {limit === null && <p className="text-[11px] text-slate-400 mt-0.5">Unlimited</p>}
      {limit === 0 && <p className="text-[11px] text-slate-400 mt-0.5">Not included in this plan</p>}
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
        <button type="submit" disabled={!dirty || busy} className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl disabled:opacity-50">{busy ? 'Saving…' : 'Save details'}</button>
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
          <button type="button" onClick={close} disabled={busy} className="px-4 py-2.5 text-sm font-medium text-slate-600 border border-slate-200 rounded-xl hover:border-slate-300 disabled:opacity-50">Cancel</button>
          <button type="submit" disabled={busy || !password} className="px-5 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl disabled:opacity-50">{busy ? 'Preparing…' : 'Download ZIP'}</button>
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
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Subscription</h1>
        <p className="text-slate-500 text-sm mt-1">Your PGBook plan, usage, invoices and data export</p>
      </div>

      <div className={`rounded-2xl border px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3 ${TONES[state.status] ?? TONES.active}`}>
        <div className="flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide opacity-70">{state.statusLabel}</p>
          <p className="text-sm mt-0.5">{statusText(state)}</p>
          {state.readOnly && state.retentionUntil && <p className="text-xs mt-1 opacity-80">Your data is kept until {day(state.retentionUntil)}.</p>}
        </div>
        {(subscription.pending || state.status === 'past_due') && provider === 'razorpay' && (
          <button onClick={() => sync.run()} disabled={sync.busy} className="flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-xl bg-white/70 hover:bg-white border border-current/10 shrink-0 disabled:opacity-60">
            <RefreshCw size={14} className={sync.busy ? 'animate-spin' : ''} /> I&apos;ve paid — refresh
          </button>
        )}
      </div>
      {subscription.pending && (
        <p className="text-sm text-slate-600 -mt-3">A checkout for {plans.find(p => p.id === subscription.pending.plan)?.label} ({subscription.pending.interval}) was started {day(subscription.pending.createdAt)}. Your plan changes as soon as the payment goes through.</p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className={`${cardCls} p-5 space-y-4`}>
          <h2 className="text-sm font-semibold text-slate-900">Usage</h2>
          <Meter label="Active tenants" used={usage.tenants} limit={limits.tenants} />
          <Meter label="Properties" used={usage.properties} limit={limits.properties} />
          <Meter label="Staff logins" used={usage.staff} limit={limits.staff} />
          <p className="text-xs text-slate-400">Recording payments, receipts and exports never count against a limit.</p>
        </div>

        <div className={`${cardCls} p-5 lg:col-span-2`}>
          <div className="flex items-center justify-between gap-3 mb-4">
            <h2 className="text-sm font-semibold text-slate-900">{current ? 'Change plan' : 'Choose a plan'}</h2>
            <div className="flex gap-1 bg-slate-100 p-1 rounded-xl" role="group" aria-label="Billing period">
              {['monthly', 'yearly'].map(i => (
                <button key={i} onClick={() => setPeriod(i)} aria-pressed={period === i}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize ${period === i ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>
                  {i}{i === 'yearly' && <span className="ml-1 text-emerald-600">−20%</span>}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {plans.map(p => {
              const isCurrent = current === p.id && (state.interval ?? 'monthly') === period
              const perMonth = period === 'yearly' ? p.yearlyMonthlyPrice : p.monthlyPrice
              return (
                <div key={p.id} className={`rounded-xl border p-4 flex flex-col ${isCurrent ? 'border-indigo-500 ring-1 ring-indigo-500' : 'border-slate-200'}`}>
                  <p className="text-sm font-semibold text-slate-900">{p.label}</p>
                  <p className="mt-1"><span className="text-2xl font-bold text-slate-900">₹{perMonth}</span><span className="text-xs text-slate-400">/month</span></p>
                  <p className="text-[11px] text-slate-400">{period === 'yearly' ? `₹${(perMonth * 12).toLocaleString('en-IN')} billed yearly` : 'billed monthly'} · GST incl.</p>
                  <p className="text-xs text-slate-600 mt-2 flex-1">{p.summary}</p>
                  {p.blocker && !isCurrent && <p className="text-[11px] text-amber-700 mt-2">{p.blocker}</p>}
                  <button
                    onClick={() => subscribe.run(p.id)}
                    disabled={isCurrent || !!p.blocker || subscribe.busy || !provider || (state.status === 'cancelling' && current === p.id)}
                    className={`mt-3 w-full text-sm font-semibold py-2 rounded-lg transition-colors disabled:cursor-not-allowed ${isCurrent ? 'bg-indigo-50 text-indigo-700' : 'bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40'}`}
                  >
                    {isCurrent ? <span className="flex items-center justify-center gap-1"><Check size={14} /> Current plan</span> : current ? 'Switch' : 'Subscribe'}
                  </button>
                </div>
              )
            })}
          </div>
          <FormError message={subscribe.error} />
          {!provider && <p className="text-xs text-amber-700 mt-3">Online payments are not set up on this server yet (Razorpay keys missing). Contact PGBook support to subscribe.</p>}
          {current && <p className="text-xs text-slate-400 mt-3">Switching starts the new plan as soon as its first payment succeeds; the old plan stops then (the unused part is not refunded).</p>}
        </div>
      </div>

      {provider === 'mock' && (
        <div className="rounded-2xl border border-dashed border-violet-300 bg-violet-50/50 p-4">
          <p className="text-sm font-semibold text-violet-900 flex items-center gap-2"><FlaskConical size={15} /> Test mode (local development)</p>
          <p className="text-xs text-violet-800 mt-1">No real payments are taken. Simulate what Razorpay would report:</p>
          <div className="flex flex-wrap gap-2 mt-3">
            {[['renew', 'Renewal succeeds'], ['renewal_failed', 'Renewal fails'], ['halt', 'All retries fail']].map(([outcome, label]) => (
              <button key={outcome} onClick={() => mock.run(outcome)} disabled={mock.busy || subscription.provider !== 'mock'} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-white border border-violet-200 text-violet-800 hover:border-violet-400 disabled:opacity-40">{label}</button>
            ))}
          </div>
          <FormError message={mock.error} />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className={`${cardCls} overflow-hidden`}>
          <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50 flex items-center gap-2"><FileText size={15} className="text-slate-500" /><h2 className="text-sm font-semibold text-slate-900">Invoices</h2></div>
          {invoices.length === 0 ? (
            <p className="text-sm text-slate-400 px-5 py-8 text-center">No invoices yet. They appear here after each payment.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {invoices.map(i => (
                <li key={i.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900">{i.number}</p>
                    <p className="text-xs text-slate-400">{day(i.issuedAt)} · {plans.find(p => p.id === i.plan)?.label ?? i.plan} ({i.interval})</p>
                  </div>
                  <span className="text-sm font-semibold text-slate-900 tabular-nums">{formatCurrency(i.total)}</span>
                  <Link href={`/dashboard/billing/invoices/${i.id}`} className="text-xs font-semibold text-indigo-600 hover:text-indigo-500">View</Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className={`${cardCls} p-5`}>
          <div className="flex items-center gap-2 mb-4"><CreditCard size={15} className="text-slate-500" /><h2 className="text-sm font-semibold text-slate-900">Billing details</h2></div>
          <DetailsForm key={JSON.stringify(data.details)} details={data.details} onSaved={setData} />
        </div>
      </div>

      <div className={`${cardCls} p-5 flex flex-col sm:flex-row sm:items-center gap-4`}>
        <div className="flex-1">
          <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2"><Download size={15} className="text-slate-500" /> Export all data</h2>
          <p className="text-xs text-slate-500 mt-1">Download everything as spreadsheets — works even when the account is read-only.</p>
        </div>
        <button onClick={() => setExporting(true)} className="px-4 py-2 text-sm font-semibold text-slate-700 border border-slate-200 hover:border-slate-300 rounded-xl">Export…</button>
      </div>

      {canCancel && (
        <div className={`${cardCls} p-5 flex flex-col sm:flex-row sm:items-center gap-4`}>
          <div className="flex-1">
            <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2"><ShieldAlert size={15} className="text-slate-500" /> Cancel subscription</h2>
            <p className="text-xs text-slate-500 mt-1">You keep full access until {day(state.currentPeriodEnd)}. After that the account is read-only (view and export only) and your data is kept for 90 days.</p>
          </div>
          <button onClick={() => setCancelling(true)} className="px-4 py-2 text-sm font-semibold text-red-700 border border-red-200 hover:border-red-300 rounded-xl">Cancel subscription</button>
        </div>
      )}

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
