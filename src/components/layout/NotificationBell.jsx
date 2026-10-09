'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Bell } from 'lucide-react'
import { api } from '@/utils/api'
import { timeAgo } from '@/utils/helpers'

const DOT = { info: 'bg-indigo-500', success: 'bg-emerald-500', warning: 'bg-amber-500', danger: 'bg-red-500' }

/**
 * In-app notifications. `basePath` is '' for the owner dashboard and '/resident' for the tenant app.
 * Polls every 2 minutes while the page is open.
 */
export default function NotificationBell({ basePath = '', headers, align = 'right', dark = false }) {
  const [data, setData] = useState({ notifications: [], unread: 0 })
  const [open, setOpen] = useState(false)
  const headersKey = JSON.stringify(headers ?? null)
  const client = useMemo(() => (headersKey !== 'null' ? api.with(JSON.parse(headersKey)) : api), [headersKey])
  const path = `${basePath}/notifications`

  const load = useCallback(() => client.get(path).then(setData).catch(() => {}), [client, path])
  useEffect(() => {
    load()
    const timer = setInterval(load, 120000)
    return () => clearInterval(timer)
  }, [load])

  async function toggle() {
    const next = !open
    setOpen(next)
    if (next && data.unread) {
      await client.post(path, {}).catch(() => {})
      setData(d => ({ ...d, unread: 0, notifications: d.notifications.map(n => ({ ...n, read: true })) }))
    }
  }

  return (
    <div className="relative">
      <button onClick={toggle} aria-label={data.unread ? `${data.unread} new notifications` : 'Notifications'} aria-expanded={open}
        className={`relative w-9 h-9 rounded-full flex items-center justify-center transition-colors ${dark ? 'text-slate-300 hover:bg-white/10' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'}`}>
        <Bell size={18} />
        {data.unread > 0 && (
          <span className="absolute top-1 right-1 min-w-4 h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold leading-4 text-center">{data.unread > 9 ? '9+' : data.unread}</span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} top-full mt-1.5 w-80 max-w-[90vw] bg-white border border-slate-200 rounded-xl shadow-lg z-20 overflow-hidden`}>
            <div className="px-4 py-2.5 border-b border-slate-100 text-sm font-semibold text-slate-900">Notifications</div>
            {data.notifications.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-slate-400">Nothing new.</p>
            ) : (
              <ul className="max-h-96 overflow-y-auto divide-y divide-slate-50">
                {data.notifications.map(n => {
                  const inner = (
                    <div className="flex gap-2.5 px-4 py-3 hover:bg-slate-50">
                      <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${n.read ? 'bg-slate-200' : DOT[n.tone] ?? DOT.info}`} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900">{n.title}</p>
                        {n.body && <p className="text-xs text-slate-500 mt-0.5 line-clamp-3">{n.body}</p>}
                        <p className="text-[11px] text-slate-400 mt-1">{timeAgo(n.createdAt)}</p>
                      </div>
                    </div>
                  )
                  return <li key={n.id}>{n.link ? <Link href={n.link} onClick={() => setOpen(false)}>{inner}</Link> : inner}</li>
                })}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  )
}
