'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Gauge, Inbox, Building, ScrollText, ShieldHalf, UserCog, LogOut, Menu, X } from 'lucide-react'
import { useAdmin } from '@/context/AdminContext'
import { adminApi } from '@/utils/adminApi'
import Spinner from '@/components/ui/Spinner'

const NAV = [
  { label: 'Command Center', path: '/admin', icon: Gauge, exact: true, capability: 'platform.view' },
  { label: 'Approvals', path: '/admin/approvals', icon: Inbox, capability: 'approvals.view', badge: true },
  { label: 'Owners', path: '/admin/owners', icon: Building, capability: 'orgs.view' },
  { label: 'Audit Log', path: '/admin/audit', icon: ScrollText, capability: 'audit.view' },
  { label: 'Admin Team', path: '/admin/team', icon: ShieldHalf, capability: 'admins.view' },
  { label: 'My Account', path: '/admin/account', icon: UserCog },
]

function Nav({ pathname, can, waiting, onNavigate }) {
  return (
    <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
      {NAV.filter(item => !item.capability || can(item.capability)).map(({ label, path, icon: Icon, exact, badge }) => {
        const active = exact ? pathname === path : pathname.startsWith(path)
        return (
          <Link key={path} href={path} onClick={onNavigate}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${active ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
            <Icon size={17} />
            <span className="flex-1">{label}</span>
            {badge && waiting > 0 && <span className="min-w-5 h-5 px-1.5 rounded-full bg-rose-500 text-white text-xs font-bold flex items-center justify-center">{waiting}</span>}
          </Link>
        )
      })}
    </nav>
  )
}

export default function AdminShell({ children }) {
  const { admin, status, meta, can, logout } = useAdmin()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [waiting, setWaiting] = useState(0)

  // Keep the approvals badge fresh as the admin moves around.
  useEffect(() => {
    if (status !== 'ready' || !can('approvals.view')) return
    adminApi.get('/approvals?view=waiting').then(d => setWaiting(d.counts.waiting)).catch(() => {})
  }, [status, pathname, can])

  if (status !== 'ready') {
    return <div className="min-h-screen bg-slate-100 flex items-center justify-center"><Spinner size={28} /></div>
  }

  const isProd = meta.environment === 'production'
  const sidebar = (
    <aside className="flex flex-col h-full bg-slate-950 border-r border-white/5">
      <div className="h-16 px-5 flex items-center justify-between border-b border-white/5 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-white font-bold text-lg" style={{ fontFamily: 'Space Grotesk' }}>PG<span className="text-indigo-400">Book</span></span>
          <span className="text-[10px] font-bold tracking-wider px-1.5 py-0.5 rounded bg-rose-500/90 text-white">ADMIN</span>
        </div>
        <button onClick={() => setOpen(false)} className="lg:hidden text-slate-500 hover:text-white" aria-label="Close menu"><X size={18} /></button>
      </div>
      <Nav pathname={pathname} can={can} waiting={waiting} onNavigate={() => setOpen(false)} />
      <div className="p-4 border-t border-white/5">
        <p className="text-white text-sm font-semibold truncate">{admin.name}</p>
        <p className="text-slate-500 text-xs truncate">{admin.roleLabel} · {admin.email}</p>
        <button onClick={logout} className="mt-3 flex items-center gap-2 text-xs text-slate-400 hover:text-rose-400">
          <LogOut size={13} /> Sign out
        </button>
      </div>
    </aside>
  )

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden">
      <div className="hidden lg:flex lg:w-60 shrink-0"><div className="w-full">{sidebar}</div></div>
      {open && (
        <>
          <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={() => setOpen(false)} />
          <div className="fixed inset-y-0 left-0 w-64 z-40 lg:hidden">{sidebar}</div>
        </>
      )}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-5 shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => setOpen(true)} className="lg:hidden text-slate-500" aria-label="Open menu"><Menu size={20} /></button>
            <span className={`text-[11px] font-bold tracking-wider px-2 py-1 rounded-md ${isProd ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-800'}`}>
              {isProd ? 'PRODUCTION' : (meta.environment ?? 'dev').toUpperCase()}
            </span>
            <span className="hidden sm:block text-xs text-slate-400">Every action here is recorded in the audit log.</span>
          </div>
          <span className="text-xs text-slate-400">Auto sign-out after {meta.idleTimeoutMinutes} min idle</span>
        </header>
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  )
}
