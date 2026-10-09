'use client'
import { useCallback, useEffect, useState } from 'react'
import { IndianRupee, Users, ShieldCheck, Building2, ScrollText, RefreshCw } from 'lucide-react'
import { api } from '@/utils/api'
import { describeEvent, eventCategory, deviceLabel, ADMIN_ROLE_LABELS } from '@/utils/auditText'
import { useAuth } from '@/context/AuthContext'
import EmptyState from '@/components/ui/EmptyState'
import Spinner from '@/components/ui/Spinner'

const FILTERS = [
  { key: '', label: 'All' },
  { key: 'money', label: 'Money' },
  { key: 'tenants', label: 'Tenants & complaints' },
  { key: 'security', label: 'Account & security' },
  { key: 'pgbook', label: 'PGBook team' },
]

const ICONS = {
  money: { icon: IndianRupee, cls: 'bg-emerald-50 text-emerald-600' },
  tenants: { icon: Users, cls: 'bg-indigo-50 text-indigo-600' },
  security: { icon: ShieldCheck, cls: 'bg-slate-100 text-slate-600' },
  pgbook: { icon: Building2, cls: 'bg-amber-50 text-amber-700' },
  admin: { icon: Building2, cls: 'bg-amber-50 text-amber-700' },
}

function dayLabel(iso) {
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date(Date.now() - 86400000)
  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}

export default function ActivityPage() {
  const { user } = useAuth()
  const [filter, setFilter] = useState('')
  const [events, setEvents] = useState([])
  const [cursor, setCursor] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async (category, after) => {
    const qs = new URLSearchParams()
    if (category) qs.set('category', category)
    if (after) qs.set('cursor', after)
    return api.get(`/activity?${qs}`)
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    load(filter)
      .then(data => { if (!cancelled) { setEvents(data.events); setCursor(data.nextCursor) } })
      .catch(err => { if (!cancelled) setError(err.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [filter, load])

  async function loadMore() {
    setLoadingMore(true)
    try {
      const data = await load(filter, cursor)
      setEvents(prev => [...prev, ...data.events])
      setCursor(data.nextCursor)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoadingMore(false)
    }
  }

  const groups = []
  for (const e of events) {
    const label = dayLabel(e.createdAt)
    if (groups.at(-1)?.label !== label) groups.push({ label, items: [] })
    groups.at(-1).items.push(e)
  }

  function who(e) {
    if (e.actor.realm === 'admin') return `PGBook ${ADMIN_ROLE_LABELS[e.actor.role] ?? 'team'} (${e.actor.name})`
    if (e.actor.realm === 'system') return 'PGBook system'
    if (e.actor.id && e.actor.id === user?.id) return 'You'
    return e.actor.name || 'Someone'
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Activity</h1>
        <p className="text-slate-500 text-sm mt-1">
          Everything that happened in your account — including any action taken by the PGBook team, with their reason.
        </p>
      </div>

      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl mb-6 w-fit max-w-full overflow-x-auto">
        {FILTERS.map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${filter === f.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            {f.label}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      {loading ? (
        <div className="flex justify-center py-16"><Spinner size={24} /></div>
      ) : events.length === 0 ? (
        <EmptyState icon={ScrollText} title="Nothing here yet" message="Actions in your account will appear here as they happen." />
      ) : (
        <div className="space-y-6">
          {groups.map(group => (
            <section key={group.label}>
              <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">{group.label}</h2>
              <ul className="bg-white rounded-2xl border border-slate-100 shadow-sm divide-y divide-slate-50">
                {group.items.map(e => {
                  const category = e.actor.realm === 'admin' ? 'pgbook' : eventCategory(e.action)
                  const { icon: Icon, cls } = ICONS[category] ?? ICONS.security
                  const isAuth = e.action.startsWith('auth.')
                  return (
                    <li key={e.id} className={`flex gap-3 px-4 py-3.5 ${e.actor.realm === 'admin' ? 'bg-amber-50/40' : ''}`}>
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${cls}`}><Icon size={15} /></div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-slate-900">{describeEvent(e)}</p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {who(e)} · {new Date(e.createdAt).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}
                          {isAuth && (e.userAgent || e.ip) && ` · ${[deviceLabel(e.userAgent), e.ip].filter(Boolean).join(' · ')}`}
                        </p>
                        {e.reason && <p className="text-xs text-slate-600 mt-1.5 bg-slate-50 rounded-lg px-2.5 py-1.5">Reason: {e.reason}</p>}
                      </div>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
          {cursor && (
            <div className="flex justify-center">
              <button onClick={loadMore} disabled={loadingMore} className="flex items-center gap-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-xl px-4 py-2 hover:border-slate-300 disabled:opacity-60">
                <RefreshCw size={14} className={loadingMore ? 'animate-spin' : ''} /> {loadingMore ? 'Loading…' : 'Load older activity'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
