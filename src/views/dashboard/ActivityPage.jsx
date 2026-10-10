'use client'
import { useCallback, useEffect, useState } from 'react'
import { ScrollText, RefreshCw } from 'lucide-react'
import { api } from '@/utils/api'
import { describeEvent, deviceLabel, ADMIN_ROLE_LABELS } from '@/utils/auditText'
import { useAuth } from '@/context/AuthContext'
import EmptyState from '@/components/ui/EmptyState'
import Spinner from '@/components/ui/Spinner'
import Badge from '@/components/ui/Badge'
import PageHeader from '@/components/ui/PageHeader'
import Tabs from '@/components/ui/Tabs'
import { btn, page } from '@/components/ui/styles'

const FILTERS = [
  { key: '', label: 'All' },
  { key: 'money', label: 'Money' },
  { key: 'tenants', label: 'Tenants & complaints' },
  { key: 'security', label: 'Account & security' },
  { key: 'pgbook', label: 'PGBook team' },
]

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
    <div className={`${page} mx-auto max-w-3xl`}>
      <PageHeader title="Activity" description="Everything that happened in your account, including any action by the PGBook team and their reason." />

      <Tabs className="mb-6" tabs={FILTERS} value={filter} onChange={setFilter} />

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {loading ? (
        <div className="flex justify-center py-16"><Spinner size={24} /></div>
      ) : events.length === 0 ? (
        <EmptyState icon={ScrollText} title="Nothing here yet" message="Actions in your account will appear here as they happen." />
      ) : (
        <div className="space-y-6">
          {groups.map(group => (
            <section key={group.label}>
              <h2 className="mb-2 text-xs font-medium text-slate-500">{group.label}</h2>
              <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
                {group.items.map(e => {
                  const byTeam = e.actor.realm === 'admin'
                  const isAuth = e.action.startsWith('auth.')
                  return (
                    <li key={e.id} className="flex gap-4 px-4 py-3">
                      <time dateTime={e.createdAt} className="w-16 shrink-0 pt-px text-xs tabular-nums text-slate-500">
                        {new Date(e.createdAt).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}
                      </time>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-slate-900">{describeEvent(e)}</p>
                        <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-slate-500">
                          {byTeam && <Badge tone="amber">PGBook team</Badge>}
                          <span>{who(e)}</span>
                          {isAuth && (e.userAgent || e.ip) && <span>· {[deviceLabel(e.userAgent), e.ip].filter(Boolean).join(' · ')}</span>}
                        </p>
                        {e.reason && <p className="mt-1.5 border-l-2 border-amber-300 pl-2.5 text-xs text-slate-600">Reason: {e.reason}</p>}
                      </div>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
          {cursor && (
            <div className="flex justify-center">
              <button onClick={loadMore} disabled={loadingMore} className={btn.secondary}>
                <RefreshCw size={14} className={loadingMore ? 'animate-spin' : ''} /> {loadingMore ? 'Loading…' : 'Load older activity'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
