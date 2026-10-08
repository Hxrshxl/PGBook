'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowLeft, CalendarPlus, LogOut, Ban, RotateCcw, Lock, RefreshCw } from 'lucide-react'
import { adminApi } from '@/utils/adminApi'
import { useToast } from '@/context/ToastContext'
import { describeEvent, deviceLabel } from '@/utils/auditText'
import Spinner from '@/components/ui/Spinner'
import Pill from '@/components/admin/Pill'
import ReasonDialog from '@/components/admin/ReasonDialog'
import { dateTime, planState, relative } from '@/components/admin/format'
import { formatDate } from '@/utils/helpers'

const TABS = ['overview', 'activity', 'security']

function Stat({ label, value, sub }) {
  return (
    <div className="bg-slate-50 rounded-xl p-3">
      <p className="text-lg font-bold text-slate-900">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
      {sub && <p className="text-[11px] text-slate-400">{sub}</p>}
    </div>
  )
}

function ActivityTab({ ownerId }) {
  const [events, setEvents] = useState([])
  const [cursor, setCursor] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async after => {
    setLoading(true)
    try {
      const data = await adminApi.get(`/owners/${ownerId}/activity${after ? `?cursor=${encodeURIComponent(after)}` : ''}`)
      setEvents(prev => (after ? [...prev, ...data.events] : data.events))
      setCursor(data.nextCursor)
    } finally {
      setLoading(false)
    }
  }, [ownerId])

  useEffect(() => { load() }, [load])

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <p className="px-4 py-3 text-xs text-slate-500 bg-slate-50 border-b border-slate-100">
        <Lock size={12} className="inline mr-1 -mt-0.5" />
        Business events show what happened, not amounts or tenant names — that data belongs to the owner.
      </p>
      <ul className="divide-y divide-slate-100">
        {events.map(e => (
          <li key={e.id} className="px-4 py-3 text-sm">
            <div className="flex items-center gap-2 flex-wrap">
              <Pill tone={e.actor.realm}>{e.actor.realm === 'admin' ? 'PGBook' : e.actor.realm === 'org' ? 'owner' : e.actor.realm}</Pill>
              <span className="text-slate-900">{describeEvent(e)}</span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">{e.actor.name} · {dateTime(e.createdAt)}{e.reason ? ` · Reason: ${e.reason}` : ''}</p>
          </li>
        ))}
        {!loading && events.length === 0 && <li className="px-4 py-10 text-center text-sm text-slate-400">No activity recorded yet.</li>}
      </ul>
      {(loading || cursor) && (
        <div className="p-3 flex justify-center border-t border-slate-100">
          {loading ? <Spinner /> : (
            <button onClick={() => load(cursor)} className="text-sm text-slate-600 border border-slate-200 rounded-xl px-4 py-1.5 hover:border-slate-300">Load older</button>
          )}
        </div>
      )}
    </div>
  )
}

export default function OwnerDetailPage() {
  const { id } = useParams()
  const { showToast } = useToast()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [tab, setTab] = useState('overview')
  const [dialog, setDialog] = useState(null) // extendTrial | forceLogout | suspend | reactivate
  const [days, setDays] = useState(7)

  const load = useCallback(async () => {
    try {
      setData(await adminApi.get(`/owners/${id}`))
      setError('')
    } catch (err) {
      setError(err.message)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  async function act(action, extra = {}) {
    const result = await adminApi.post(`/owners/${id}/actions`, { action, ...extra })
    showToast(result.message, result.approval ? 'info' : 'success')
    setDialog(null)
    await load()
    return result
  }

  if (!data) {
    return <div className="flex justify-center py-24">{error ? <p className="text-rose-600 text-sm">{error}</p> : <Spinner size={26} />}</div>
  }

  const { owner, usage, logins, pendingApprovals, allowed } = data
  const p = planState(owner)
  const suspended = owner.status === 'suspended'
  const btn = 'flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-xl border transition-colors'

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
      <Link href="/admin/owners" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700"><ArrowLeft size={15} /> Owners</Link>

      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-5">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-slate-900">{owner.name}</h1>
              <Pill tone={owner.status}>{owner.status}</Pill>
              <Pill tone={p.tone}>{p.label}</Pill>
            </div>
            <p className="text-slate-500 text-sm mt-1">{owner.pgName || 'No PG name'} · {owner.email}{owner.phone ? ` · ${owner.phone}` : ''}</p>
            <p className="text-slate-400 text-xs mt-1">
              Signed up {formatDate(owner.createdAt)} · Last sign-in {relative(owner.lastLoginAt)} · Last active {relative(owner.lastActiveAt)}
              {owner.trialEndsAt && ` · Trial ends ${formatDate(owner.trialEndsAt)}`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            {allowed.extendTrialDays > 0 && owner.plan === 'trial' && (
              <button onClick={() => setDialog('extendTrial')} className={`${btn} border-slate-200 text-slate-700 hover:border-slate-300`}><CalendarPlus size={15} /> Extend trial</button>
            )}
            {allowed.forceLogout && (
              <button onClick={() => setDialog('forceLogout')} className={`${btn} border-slate-200 text-slate-700 hover:border-slate-300`}><LogOut size={15} /> Sign out sessions</button>
            )}
            {!suspended && allowed.suspend && (
              <button onClick={() => setDialog('suspend')} className={`${btn} border-rose-200 text-rose-700 hover:bg-rose-50`}>
                <Ban size={15} /> {allowed.suspend === 'request' ? 'Request suspension' : 'Suspend'}
              </button>
            )}
            {suspended && allowed.reactivate && (
              <button onClick={() => setDialog('reactivate')} className={`${btn} border-emerald-200 text-emerald-700 hover:bg-emerald-50`}>
                <RotateCcw size={15} /> {allowed.reactivate === 'request' ? 'Request reactivation' : 'Reactivate'}
              </button>
            )}
          </div>
        </div>

        {suspended && owner.suspension && (
          <div className="mt-4 bg-rose-50 border border-rose-100 rounded-xl px-4 py-3 text-sm text-rose-800">
            Suspended {dateTime(owner.suspension.at)} by {owner.suspension.by}: “{owner.suspension.reason}”. The owner cannot sign in; their data is intact.
          </div>
        )}
        {pendingApprovals.length > 0 && (
          <div className="mt-4 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-sm text-amber-900">
            Waiting for approval: {pendingApprovals.map(a => a.summary).join(' · ')} — <Link href="/admin/approvals" className="underline">open approvals</Link>
          </div>
        )}
      </div>

      <div className="flex gap-1 bg-slate-200/60 p-1 rounded-xl w-fit">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-1.5 rounded-lg text-sm font-medium capitalize ${tab === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>{t}</button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <section className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-5">
            <h2 className="font-semibold text-slate-900 text-sm mb-1">Usage</h2>
            <p className="text-xs text-slate-400 mb-4">Counts only. Amounts and tenant details stay private to the owner.</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Stat label="Active tenants" value={usage.activeTenants} sub={usage.planTenantLimit ? `plan limit ${usage.planTenantLimit}` : undefined} />
              <Stat label="Vacated (all time)" value={usage.vacatedTenants} />
              <Stat label="Beds" value={usage.beds || '—'} sub={usage.occupancy !== null ? `${usage.occupancy}% occupied` : 'not set'} />
              <Stat label="Dues this month" value={usage.duesThisMonth} />
              <Stat label="Payments logged (30d)" value={usage.paymentsRecorded30} />
              <Stat label="Open complaints" value={usage.openComplaints} sub={`${usage.totalComplaints} total`} />
              <Stat label="Utility bills" value={usage.utilityBills} />
              <Stat label="Owner actions (30d)" value={usage.ownerActions30} />
            </div>
          </section>
          <section className="bg-white rounded-2xl border border-slate-200 p-5">
            <h2 className="font-semibold text-slate-900 text-sm mb-3">Account</h2>
            <dl className="space-y-2 text-sm">
              {[
                ['Plan', owner.planLabel],
                ['Status', owner.status],
                ['Address', owner.address || '—'],
                ['Account ID', <code key="id" className="text-xs break-all">{owner.id}</code>],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3">
                  <dt className="text-slate-500 shrink-0">{k}</dt>
                  <dd className="text-slate-900 text-right break-words min-w-0">{v}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>
      )}

      {tab === 'activity' && <ActivityTab ownerId={owner.id} />}

      {tab === 'security' && (
        <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900 text-sm">Recent sign-ins</h2>
            <button onClick={load} className="text-slate-400 hover:text-slate-600" aria-label="Refresh"><RefreshCw size={14} /></button>
          </div>
          <ul className="divide-y divide-slate-100">
            {logins.map(l => (
              <li key={l.id} className="px-4 py-3 flex items-center justify-between gap-3 text-sm">
                <div>
                  <Pill tone={l.action === 'auth.login' ? 'active' : 'suspended'}>
                    {l.action === 'auth.login' ? 'Signed in' : l.action === 'auth.login_failed' ? 'Wrong password' : 'Blocked (suspended)'}
                  </Pill>
                  <span className="text-slate-500 ml-2">{deviceLabel(l.userAgent) || 'Unknown device'}{l.ip ? ` · ${l.ip}` : ''}</span>
                </div>
                <span className="text-xs text-slate-400 shrink-0">{dateTime(l.at)}</span>
              </li>
            ))}
            {logins.length === 0 && <li className="px-4 py-10 text-center text-sm text-slate-400">No sign-ins recorded yet.</li>}
          </ul>
        </section>
      )}

      <ReasonDialog
        isOpen={dialog === 'extendTrial'}
        title="Extend free trial"
        description={<>Adds days from today or from the current trial end, whichever is later. Your role allows up to <strong>{allowed.extendTrialDays}</strong> days.</>}
        confirmLabel="Extend trial"
        fields={{ days }}
        onSubmit={({ reason }) => act('extendTrial', { reason, days })}
        onClose={() => setDialog(null)}
        reasonHint="Shown to the owner in their Activity log."
      >
        <div>
          <label htmlFor="days" className="block text-slate-700 text-sm font-medium mb-1.5">Days to add</label>
          <input id="days" type="number" min={1} max={allowed.extendTrialDays} value={days} onChange={e => setDays(Number(e.target.value))}
            className="w-32 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-indigo-500" />
        </div>
      </ReasonDialog>

      <ReasonDialog
        isOpen={dialog === 'forceLogout'}
        title="Sign out all sessions"
        description="Ends every active session for this owner on all devices. They can sign in again with their password. Use this if an account may be compromised."
        confirmLabel="Sign out everywhere"
        onSubmit={({ reason }) => act('forceLogout', { reason })}
        onClose={() => setDialog(null)}
        reasonHint="Shown to the owner in their Activity log."
      />

      <ReasonDialog
        isOpen={dialog === 'suspend'}
        tone="danger"
        title={allowed.suspend === 'request' ? 'Request suspension' : 'Suspend account'}
        description={allowed.suspend === 'request'
          ? 'Your role needs a second admin to approve suspensions. The request goes to the Approvals queue.'
          : 'The owner is signed out immediately and cannot sign in. Their data stays intact and the suspension can be reversed.'}
        confirmLabel={allowed.suspend === 'request' ? 'Send for approval' : 'Suspend account'}
        onSubmit={({ reason }) => act('suspend', { reason })}
        onClose={() => setDialog(null)}
        reasonHint="Shown to the owner in their Activity log once they can sign in again."
      />

      <ReasonDialog
        isOpen={dialog === 'reactivate'}
        title={allowed.reactivate === 'request' ? 'Request reactivation' : 'Reactivate account'}
        description="The owner will be able to sign in again."
        confirmLabel={allowed.reactivate === 'request' ? 'Send for approval' : 'Reactivate'}
        onSubmit={({ reason }) => act('reactivate', { reason })}
        onClose={() => setDialog(null)}
      />
    </div>
  )
}
