'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, ArrowRight, Clock, Database, Inbox, KeyRound, RefreshCw, ShieldAlert, UserX } from 'lucide-react'
import { adminApi } from '@/utils/adminApi'
import { useAdmin } from '@/context/AdminContext'
import { describeEvent } from '@/utils/auditText'
import { formatCurrencyRounded, formatMonth } from '@/utils/helpers'
import BarChart from '@/components/analytics/BarChart'
import Spinner from '@/components/ui/Spinner'
import Pill from '@/components/admin/Pill'
import { daysUntil, relative } from '@/components/admin/format'

function Kpi({ label, value, sub, tone = 'text-slate-900' }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4">
      <p className={`text-2xl font-bold ${tone}`}>{value}</p>
      <p className="text-slate-700 text-sm font-medium mt-0.5">{label}</p>
      {sub && <p className="text-slate-400 text-xs mt-0.5">{sub}</p>}
    </div>
  )
}

function AttentionRow({ icon: Icon, tone, children, href }) {
  const body = (
    <div className="flex items-center gap-3 px-4 py-3">
      <Icon size={16} className={tone} />
      <div className="flex-1 text-sm text-slate-700">{children}</div>
      {href && <ArrowRight size={14} className="text-slate-400" />}
    </div>
  )
  return href ? <Link href={href} className="block hover:bg-slate-50">{body}</Link> : body
}

export default function CommandCenterPage() {
  const { can } = useAdmin()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    setRefreshing(true)
    try {
      setData(await adminApi.get('/overview'))
      setError('')
    } catch (err) {
      setError(err.message)
    } finally {
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  if (!data) {
    return <div className="flex justify-center py-24">{error ? <p className="text-rose-600 text-sm">{error}</p> : <Spinner size={26} />}</div>
  }

  const { owners, usage, attention, health } = data
  const seeAccounts = can('orgs.view')
  const quiet = !attention.approvalsWaiting && !attention.trialsEnding.length && !attention.suspended.length
    && !attention.failedOwnerLogins && !attention.failedAdminLogins && !attention.payoutChanges

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Command Center</h1>
          <p className="text-slate-500 text-sm mt-1">Platform health and what needs a decision.</p>
        </div>
        <button onClick={load} disabled={refreshing} className="flex items-center gap-2 text-sm text-slate-600 border border-slate-200 bg-white rounded-xl px-3 py-2 hover:border-slate-300 disabled:opacity-60">
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      <section>
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">Owners</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
          <Kpi label="Total owners" value={owners.total} sub={`+${owners.signups7} this week · +${owners.signups30} in 30d`} />
          <Kpi label="Active (30 days)" value={owners.active30} sub={owners.total ? `${Math.round((owners.active30 / owners.total) * 100)}% of owners` : '—'} />
          <Kpi label="On free trial" value={owners.onTrial} sub={`${owners.trialsEndingSoon} ending in ≤ 3 days`} tone="text-amber-700" />
          <Kpi label="Trial expired" value={owners.trialExpired} sub="not yet converted" tone={owners.trialExpired ? 'text-rose-600' : 'text-slate-900'} />
          <Kpi label="Paying owners" value={owners.paid} sub="billing arrives in Phase 2" tone="text-indigo-700" />
          <Kpi label="Est. MRR" value={formatCurrencyRounded(owners.estMrr)} sub="at list prices" tone="text-indigo-700" />
          <Kpi label="Suspended" value={owners.suspended} tone={owners.suspended ? 'text-rose-600' : 'text-slate-900'} />
        </div>
      </section>

      <section>
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">Platform usage</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Kpi label="Active tenants" value={usage.activeTenants.toLocaleString('en-IN')} />
          <Kpi label="Beds managed" value={usage.beds.toLocaleString('en-IN')} sub="owners who entered bed counts" />
          <Kpi label="Occupancy" value={usage.occupancy === null ? '—' : `${usage.occupancy}%`} />
          <Kpi label={`Payments logged · ${formatMonth(usage.month)}`} value={usage.paymentsCount.toLocaleString('en-IN')}
            sub={usage.paymentsVolume === null
              ? `₹ total hidden until ≥ ${usage.minOrgsForTotals} owners (privacy)`
              : `${formatCurrencyRounded(usage.paymentsVolume)} across ${usage.paymentOrgs} owners`} />
          <Kpi label="Open complaints" value={usage.openComplaints} />
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
            <AlertTriangle size={15} className="text-amber-500" />
            <h2 className="font-semibold text-slate-900 text-sm">Needs attention</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {attention.approvalsWaiting > 0 && (
              <AttentionRow icon={Inbox} tone="text-rose-500" href="/admin/approvals">
                <strong>{attention.approvalsWaiting}</strong> request(s) waiting for your approval
                <span className="block text-xs text-slate-400">{attention.approvals.map(a => a.summary).join(' · ')}</span>
              </AttentionRow>
            )}
            {attention.trialsEnding.map(t => (
              <AttentionRow key={t.id} icon={Clock} tone="text-amber-500" href={`/admin/owners/${t.id}`}>
                Trial ends in {Math.max(0, daysUntil(t.trialEnd))} day(s): <strong>{t.name}</strong>{t.pgName ? ` · ${t.pgName}` : ''}
              </AttentionRow>
            ))}
            {attention.suspended.map(s => (
              <AttentionRow key={s.id} icon={UserX} tone="text-rose-500" href={`/admin/owners/${s.id}`}>
                Suspended: <strong>{s.name}</strong>{s.pgName ? ` · ${s.pgName}` : ''}
                <span className="block text-xs text-slate-400">{s.suspension?.reason} — {s.suspension?.by}, {relative(s.suspension?.at)}</span>
              </AttentionRow>
            ))}
            {attention.failedOwnerLogins > 0 && (
              <AttentionRow icon={KeyRound} tone="text-amber-500" href="/admin/audit?action=auth.login_failed">
                <strong>{attention.failedOwnerLogins}</strong> failed owner sign-in attempts in the last 24 h
              </AttentionRow>
            )}
            {attention.failedAdminLogins > 0 && (
              <AttentionRow icon={ShieldAlert} tone="text-rose-500" href="/admin/audit?realm=admin&action=admin.">
                <strong>{attention.failedAdminLogins}</strong> failed admin sign-ins or lockouts in the last 24 h
              </AttentionRow>
            )}
            {attention.payoutChanges > 0 && (
              <AttentionRow icon={ShieldAlert} tone="text-amber-500" href="/admin/audit?action=settings.payout_upi_changed">
                <strong>{attention.payoutChanges}</strong> owner(s) changed their payout UPI ID this week — check for account takeover
              </AttentionRow>
            )}
            {quiet && <p className="px-4 py-8 text-center text-sm text-slate-400">Nothing needs attention right now.</p>}
          </div>
        </section>

        <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
            <Database size={15} className="text-emerald-500" />
            <h2 className="font-semibold text-slate-900 text-sm">System health</h2>
          </div>
          <dl className="px-4 py-3 space-y-2 text-sm">
            {[
              ['Database', <span key="db" className="flex items-center gap-2"><span className={`w-2 h-2 rounded-full ${health.dbLatencyMs < 200 ? 'bg-emerald-500' : 'bg-amber-500'}`} />{health.dbLatencyMs} ms</span>],
              ['App version', health.version],
              ['Environment', health.environment],
              ['Node.js', health.node],
              ['Uptime', `${health.uptimeMinutes} min`],
              ['Scheduled jobs', 'Phase 2'],
            ].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between">
                <dt className="text-slate-500">{k}</dt>
                <dd className="text-slate-900 font-medium">{v}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-white rounded-2xl border border-slate-200 p-5">
          <h2 className="font-semibold text-slate-900 text-sm mb-1">Signups per week</h2>
          <p className="text-xs text-slate-400 mb-5">Last 12 weeks</p>
          <BarChart
            data={data.signupsByWeek.map(w => ({ label: new Date(w.weekStart).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }), value: w.count }))}
            formatValue={v => `${v} signup${v === 1 ? '' : 's'}`}
          />
        </section>

        {seeAccounts && (
          <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <h2 className="font-semibold text-slate-900 text-sm">Live activity</h2>
              <Link href="/admin/audit" className="text-xs text-indigo-600 hover:text-indigo-700">Audit log →</Link>
            </div>
            <ul className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
              {data.activity.map(e => (
                <li key={e.id} className="px-4 py-2.5 text-sm">
                  <div className="flex items-center gap-2">
                    <Pill tone={e.actor.realm}>{e.actor.realm}</Pill>
                    <span className="text-slate-900 truncate">{describeEvent(e)}</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {e.actor.name}{e.orgId && <> · <Link href={`/admin/owners/${e.orgId}`} className="hover:text-indigo-600">owner account</Link></>} · {relative(e.createdAt)}
                  </p>
                </li>
              ))}
              {data.activity.length === 0 && <li className="px-4 py-8 text-center text-sm text-slate-400">No activity yet.</li>}
            </ul>
          </section>
        )}
      </div>
    </div>
  )
}
