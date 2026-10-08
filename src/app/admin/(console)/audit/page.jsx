'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Download, Filter } from 'lucide-react'
import { adminApi } from '@/utils/adminApi'
import { useAdmin } from '@/context/AdminContext'
import { useToast } from '@/context/ToastContext'
import { describeEvent, deviceLabel, ADMIN_ROLE_LABELS } from '@/utils/auditText'
import Spinner from '@/components/ui/Spinner'
import Pill from '@/components/admin/Pill'
import { dateTime } from '@/components/admin/format'

const inputCls = 'border border-slate-200 bg-white rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:border-indigo-500'
const EMPTY = { realm: '', action: '', actor: '', orgId: '', from: '', to: '' }

export default function AuditLogPage() {
  const { can } = useAdmin()
  const { showToast } = useToast()
  const [form, setForm] = useState(EMPTY)
  const [filters, setFilters] = useState(EMPTY)
  const [events, setEvents] = useState([])
  const [cursor, setCursor] = useState(null)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)

  // Pre-fill filters from links like /admin/audit?action=auth.login_failed
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const initial = { ...EMPTY }
    for (const key of Object.keys(EMPTY)) initial[key] = params.get(key) ?? ''
    setForm(initial)
    setFilters(initial)
  }, [])

  const query = useCallback((after) => {
    const params = new URLSearchParams()
    for (const [k, v] of Object.entries(filters)) if (v) params.set(k, v)
    if (after) params.set('cursor', after)
    return params.toString()
  }, [filters])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    adminApi.get(`/audit?${query()}`)
      .then(d => { if (!cancelled) { setEvents(d.events); setCursor(d.nextCursor) } })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [query])

  async function more() {
    setLoading(true)
    try {
      const d = await adminApi.get(`/audit?${query(cursor)}`)
      setEvents(prev => [...prev, ...d.events])
      setCursor(d.nextCursor)
    } finally {
      setLoading(false)
    }
  }

  async function exportCsv() {
    setExporting(true)
    try {
      await adminApi.download(`/audit/export?${query()}`)
      showToast('Export downloaded. The export itself was recorded in the audit log.')
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setExporting(false)
    }
  }

  const set = key => e => setForm(prev => ({ ...prev, [key]: e.target.value }))

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Audit Log</h1>
          <p className="text-slate-500 text-sm mt-1">Every sign-in, change and decision across the platform. Append-only — nobody can edit or delete entries.</p>
        </div>
        {can('audit.export') && (
          <button onClick={exportCsv} disabled={exporting} className="flex items-center gap-2 text-sm font-medium bg-white border border-slate-200 rounded-xl px-3 py-2 hover:border-slate-300 disabled:opacity-60 shrink-0">
            <Download size={15} /> {exporting ? 'Exporting…' : 'Export CSV'}
          </button>
        )}
      </div>

      <form onSubmit={e => { e.preventDefault(); setFilters(form) }} className="flex flex-wrap gap-2 mb-5">
        <select aria-label="Realm" value={form.realm} onChange={set('realm')} className={inputCls}>
          <option value="">All realms</option>
          <option value="admin">PGBook admins</option>
          <option value="org">Owners</option>
          <option value="system">System</option>
        </select>
        <input aria-label="Action starts with" placeholder="Action, e.g. admin. or org.suspended" value={form.action} onChange={set('action')} className={`${inputCls} w-64`} />
        <input aria-label="Actor name" placeholder="Actor name" value={form.actor} onChange={set('actor')} className={`${inputCls} w-40`} />
        <input aria-label="Owner account ID" placeholder="Owner account ID" value={form.orgId} onChange={set('orgId')} className={`${inputCls} w-56`} />
        <input aria-label="From date" type="date" value={form.from} onChange={set('from')} className={inputCls} />
        <input aria-label="To date" type="date" value={form.to} onChange={set('to')} className={inputCls} />
        <button type="submit" className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-500"><Filter size={14} /> Apply</button>
        <button type="button" onClick={() => { setForm(EMPTY); setFilters(EMPTY) }} className="text-sm text-slate-500 px-2">Clear</button>
      </form>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-left text-xs uppercase tracking-wider text-slate-500">
                <th scope="col" className="px-4 py-3 font-medium">When</th>
                <th scope="col" className="px-4 py-3 font-medium">Who</th>
                <th scope="col" className="px-4 py-3 font-medium">What</th>
                <th scope="col" className="px-4 py-3 font-medium">Reason</th>
                <th scope="col" className="px-4 py-3 font-medium">From</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {events.map(e => (
                <tr key={e.id} className="align-top hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{dateTime(e.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2"><Pill tone={e.actor.realm}>{e.actor.realm}</Pill><span className="text-slate-900">{e.actor.name}</span></div>
                    {e.actor.realm === 'admin' && <p className="text-xs text-slate-400 mt-0.5">{ADMIN_ROLE_LABELS[e.actor.role] ?? e.actor.role}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-slate-900">{describeEvent(e)}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      <code>{e.action}</code>
                      {e.orgId && <> · <Link href={`/admin/owners/${e.orgId}`} className="hover:text-indigo-600">owner account</Link></>}
                      {e.redacted && ' · details private to owner'}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-slate-600 max-w-xs">{e.reason || <span className="text-slate-300">—</span>}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{[deviceLabel(e.userAgent), e.ip].filter(Boolean).join(' · ') || '—'}</td>
                </tr>
              ))}
              {!loading && events.length === 0 && <tr><td colSpan={5} className="py-16 text-center text-slate-400">No events match these filters.</td></tr>}
            </tbody>
          </table>
        </div>
        {(loading || cursor) && (
          <div className="p-3 flex justify-center border-t border-slate-100">
            {loading ? <Spinner /> : <button onClick={more} className="text-sm text-slate-600 border border-slate-200 rounded-xl px-4 py-1.5 hover:border-slate-300">Load older</button>}
          </div>
        )}
      </div>
    </div>
  )
}
