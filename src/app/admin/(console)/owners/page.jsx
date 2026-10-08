'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Search, ChevronLeft, ChevronRight } from 'lucide-react'
import { adminApi } from '@/utils/adminApi'
import Spinner from '@/components/ui/Spinner'
import Pill from '@/components/admin/Pill'
import { planState, relative } from '@/components/admin/format'
import { formatDate } from '@/utils/helpers'

const selectCls = 'border border-slate-200 bg-white rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:border-indigo-500'

export default function OwnersPage() {
  const [q, setQ] = useState('')
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  const [plan, setPlan] = useState('')
  const [trial, setTrial] = useState('')
  const [sort, setSort] = useState('newest')
  const [page, setPage] = useState(1)
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  // Debounce typing in the search box
  useEffect(() => {
    const t = setTimeout(() => { setQuery(q.trim()); setPage(1) }, 300)
    return () => clearTimeout(t)
  }, [q])

  useEffect(() => {
    let cancelled = false
    const params = new URLSearchParams({ page: String(page), sort })
    if (query) params.set('q', query)
    if (status) params.set('status', status)
    if (plan) params.set('plan', plan)
    if (trial) params.set('trial', trial)
    setLoading(true)
    adminApi.get(`/owners?${params}`)
      .then(d => { if (!cancelled) { setData(d); setError('') } })
      .catch(err => { if (!cancelled) setError(err.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [query, status, plan, trial, sort, page])

  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1
  const filter = (setter) => e => { setter(e.target.value); setPage(1) }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Owners</h1>
        <p className="text-slate-500 text-sm mt-1">PG owner accounts. You see account details and usage counts — not their tenants or money.</p>
      </div>

      <div className="flex flex-wrap gap-3 mb-5">
        <div className="relative flex-1 min-w-56">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Search name, email or PG name" aria-label="Search owners"
            className="w-full border border-slate-200 bg-white rounded-xl pl-9 pr-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-indigo-500" />
        </div>
        <select aria-label="Status" value={status} onChange={filter(setStatus)} className={selectCls}>
          <option value="">Any status</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </select>
        <select aria-label="Plan" value={plan} onChange={filter(setPlan)} className={selectCls}>
          <option value="">Any plan</option>
          <option value="trial">Free trial</option>
          <option value="paid">Any paid plan</option>
          <option value="starter">Starter</option>
          <option value="pro">Pro</option>
          <option value="multi">Multi-PG</option>
        </select>
        <select aria-label="Trial" value={trial} onChange={filter(setTrial)} className={selectCls}>
          <option value="">Any trial state</option>
          <option value="ending">Trial ending ≤ 3 days</option>
          <option value="expired">Trial expired</option>
        </select>
        <select aria-label="Sort" value={sort} onChange={filter(setSort)} className={selectCls}>
          <option value="newest">Newest first</option>
          <option value="active">Recently active</option>
          <option value="name">Name A–Z</option>
          <option value="oldest">Oldest first</option>
        </select>
      </div>

      {error && <p className="text-rose-600 text-sm mb-4">{error}</p>}

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[860px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-left text-xs uppercase tracking-wider text-slate-500">
                <th scope="col" className="px-4 py-3 font-medium">Owner</th>
                <th scope="col" className="px-4 py-3 font-medium">Plan</th>
                <th scope="col" className="px-4 py-3 font-medium">Status</th>
                <th scope="col" className="px-4 py-3 font-medium text-right">Tenants</th>
                <th scope="col" className="px-4 py-3 font-medium text-right">Beds</th>
                <th scope="col" className="px-4 py-3 font-medium">Last active</th>
                <th scope="col" className="px-4 py-3 font-medium">Signed up</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && !data ? (
                <tr><td colSpan={7} className="py-16 text-center"><Spinner /></td></tr>
              ) : data?.owners.length === 0 ? (
                <tr><td colSpan={7} className="py-16 text-center text-slate-400">No owners match these filters.</td></tr>
              ) : data?.owners.map(o => {
                const p = planState(o)
                return (
                  <tr key={o.id} className={`hover:bg-slate-50 ${loading ? 'opacity-60' : ''}`}>
                    <td className="px-4 py-3">
                      <Link href={`/admin/owners/${o.id}`} className="font-medium text-slate-900 hover:text-indigo-600">{o.name}</Link>
                      <p className="text-xs text-slate-400">{o.pgName || '—'} · {o.email}</p>
                    </td>
                    <td className="px-4 py-3"><Pill tone={p.tone}>{p.label}</Pill></td>
                    <td className="px-4 py-3"><Pill tone={o.status}>{o.status}</Pill></td>
                    <td className="px-4 py-3 text-right text-slate-700">{o.activeTenants}<span className="text-slate-400"> / {o.totalTenants}</span></td>
                    <td className="px-4 py-3 text-right text-slate-700">{o.beds || '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{relative(o.lastActiveAt)}</td>
                    <td className="px-4 py-3 text-slate-600">{formatDate(o.createdAt)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {data && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 text-sm text-slate-500">
            <span>{data.total} owner{data.total === 1 ? '' : 's'}</span>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} aria-label="Previous page" className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-40"><ChevronLeft size={15} /></button>
              <span>Page {page} of {pages}</span>
              <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page >= pages} aria-label="Next page" className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-40"><ChevronRight size={15} /></button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
