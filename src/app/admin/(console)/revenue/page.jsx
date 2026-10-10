'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { adminApi } from '@/utils/adminApi'
import Spinner from '@/components/ui/Spinner'
import Pill from '@/components/admin/Pill'
import { formatCurrency, formatDate } from '@/utils/helpers'

function Kpi({ label, value, sub }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
      <p className="text-xl font-semibold tracking-tight text-slate-900 mt-1">{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  )
}

function OwnerList({ title, rows, date, dateLabel, empty }) {
  return (
    <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <h2 className="font-semibold text-slate-900 text-sm px-4 py-3 border-b border-slate-100">{title} <span className="text-slate-400 font-normal">({rows.length})</span></h2>
      <ul className="divide-y divide-slate-100">
        {rows.map(r => (
          <li key={r.id} className="px-4 py-2.5 flex items-center justify-between gap-3 text-sm">
            <Link href={`/admin/owners/${r.id}`} className="min-w-0">
              <span className="font-medium text-slate-900 hover:text-indigo-600 truncate block">{r.name}</span>
              <span className="text-xs text-slate-400 truncate block">{r.email} · {r.plan}</span>
            </Link>
            <span className="text-xs text-slate-500 shrink-0">{dateLabel} {r[date] ? formatDate(r[date]) : '—'}</span>
          </li>
        ))}
        {rows.length === 0 && <li className="px-4 py-6 text-center text-sm text-slate-400">{empty}</li>}
      </ul>
    </section>
  )
}

export default function RevenuePage() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => { adminApi.get('/revenue').then(setData).catch(e => setError(e.message)) }, [])
  if (!data) return <div className="flex justify-center py-24">{error ? <p className="text-rose-600 text-sm">{error}</p> : <Spinner size={26} />}</div>

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">Revenue</h1>
        <p className="text-slate-500 text-sm mt-1">PGBook subscriptions (owners&apos; rent collections are never shown here)</p>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label="MRR" value={formatCurrency(data.mrr)} sub={`ARR ${formatCurrency(data.arr)} · GST incl.`} />
        <Kpi label="Collected (30 days)" value={formatCurrency(data.last30.collected)} sub={`${data.last30.invoices} invoices · GST ${formatCurrency(data.last30.gst)}`} />
        <Kpi label="Failed payments (30 days)" value={data.last30.failedPayments} sub={`${data.counts.pastDue} owners past due now`} />
        <Kpi label="Read-only accounts" value={data.counts.readOnly} sub={`${data.counts.trialsEnding} trials end in ≤ 3 days`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="font-semibold text-slate-900 text-sm mb-3">Plan mix</h2>
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-slate-500 uppercase"><th className="py-1.5">Plan</th><th className="text-right">Paying owners</th><th className="text-right">MRR</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {data.byPlan.map(p => <tr key={p.id}><td className="py-2">{p.label}</td><td className="text-right tabular-nums">{p.count}</td><td className="text-right tabular-nums">{formatCurrency(p.mrr)}</td></tr>)}
            </tbody>
          </table>
        </section>
        <section className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="font-semibold text-slate-900 text-sm mb-3">Accounts by status</h2>
          <div className="flex flex-wrap gap-2">
            {data.byStatus.map(s => <span key={s.status} className="text-sm"><Pill tone={['unpaid', 'ended', 'trial_expired'].includes(s.status) ? 'suspended' : s.status === 'past_due' ? 'expired' : s.status === 'trialing' ? 'trial' : 'active'}>{s.label}</Pill> <span className="text-slate-600 tabular-nums">{s.count}</span></span>)}
          </div>
        </section>
      </div>

      {data.attention && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <OwnerList title="Payment failing" rows={data.attention.pastDue} date="graceUntil" dateLabel="read-only" empty="No failed renewals." />
          <OwnerList title="Trials ending soon" rows={data.attention.trialsEnding} date="trialEndsAt" dateLabel="ends" empty="No trials end in the next 3 days." />
          <OwnerList title="Cancelling" rows={data.attention.cancelling} date="endsAt" dateLabel="ends" empty="Nobody is cancelling." />
          <OwnerList title="Read-only (data retention)" rows={data.attention.readOnly} date="retentionUntil" dateLabel="kept until" empty="No read-only accounts." />
        </div>
      )}

      <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <h2 className="font-semibold text-slate-900 text-sm px-4 py-3 border-b border-slate-100">Recent invoices</h2>
        <ul className="divide-y divide-slate-100">
          {data.invoices.map(i => (
            <li key={i.id} className="px-4 py-2.5 flex items-center justify-between gap-3 text-sm">
              <span className="font-medium text-slate-900">{i.number}</span>
              <span className="text-slate-500 truncate">{i.owner ? <Link href={`/admin/owners/${i.orgId}`} className="hover:text-indigo-600">{i.owner}</Link> : ''} · {i.plan} ({i.interval}) · {formatDate(i.issuedAt)}</span>
              <span className="tabular-nums text-slate-900">{formatCurrency(i.total)}</span>
            </li>
          ))}
          {data.invoices.length === 0 && <li className="px-4 py-8 text-center text-sm text-slate-400">No invoices yet.</li>}
        </ul>
      </section>
    </div>
  )
}
