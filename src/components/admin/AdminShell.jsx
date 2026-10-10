'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Gauge, Inbox, Building, ScrollText, ShieldHalf, UserCog, LogOut, Menu, X, IndianRupee } from 'lucide-react'
import { useAdmin } from '@/context/AdminContext'
import { adminApi } from '@/utils/adminApi'
import Spinner from '@/components/ui/Spinner'
import Logo from '@/components/ui/Logo'

const NAV = [
  { label: 'Overview', path: '/admin', icon: Gauge, exact: true, capability: 'platform.view' },
  { label: 'Approvals', path: '/admin/approvals', icon: Inbox, capability: 'approvals.view', badge: true },
  { label: 'Owners', path: '/admin/owners', icon: Building, capability: 'orgs.view' },
  { label: 'Revenue', path: '/admin/revenue', icon: IndianRupee, capability: 'revenue.view' },
  { label: 'Audit log', path: '/admin/audit', icon: ScrollText, capability: 'audit.view' },
  { label: 'Admin team', path: '/admin/team', icon: ShieldHalf, capability: 'admins.view' },
  { label: 'My account', path: '/admin/account', icon: UserCog },
]

function Nav({ pathname, can, waiting, onNavigate }) {
  return (
    <nav className="flex-1 space-y-px overflow-y-auto px-3 py-3">
      {NAV.filter(item => !item.capability || can(item.capability)).map(({ label, path, icon: Icon, exact, badge }) => {
        const active = exact ? pathname === path : pathname.startsWith(path)
        return (
          <Link key={path} href={path} onClick={onNavigate}
            aria-current={active ? 'page' : undefined}
            className={`flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[13px] transition-colors ${active ? 'bg-white/10 font-medium text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}>
            <Icon size={16} strokeWidth={1.75} />
            <span className="flex-1">{label}</span>
            {badge && waiting > 0 && <span className="rounded bg-white/15 px-1.5 text-xs font-medium tabular-nums text-white">{waiting}</span>}
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
    return <div className="flex min-h-screen items-center justify-center bg-slate-50"><Spinner size={28} /></div>
  }

  const isProd = meta.environment === 'production'
  const sidebar = (
    <aside className="flex h-full flex-col bg-slate-950">
      <div className="flex h-14 shrink-0 items-center justify-between px-5">
        <div className="flex items-center gap-2">
          <Logo inverted />
          <span className="rounded bg-white/10 px-1.5 py-0.5 text-[11px] font-medium text-slate-300">Admin</span>
        </div>
        <button onClick={() => setOpen(false)} className="text-slate-500 hover:text-white lg:hidden" aria-label="Close menu"><X size={18} /></button>
      </div>
      <Nav pathname={pathname} can={can} waiting={waiting} onNavigate={() => setOpen(false)} />
      <div className="flex items-center gap-2 border-t border-white/10 p-3">
        <div className="min-w-0 flex-1 px-2">
          <p className="truncate text-[13px] font-medium text-white">{admin.name}</p>
          <p className="truncate text-xs text-slate-500">{admin.roleLabel}</p>
        </div>
        <button onClick={logout} title="Sign out" aria-label="Sign out" className="rounded-md p-2 text-slate-400 hover:bg-white/10 hover:text-white">
          <LogOut size={15} />
        </button>
      </div>
    </aside>
  )

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <div className="hidden shrink-0 lg:flex lg:w-[232px]"><div className="w-full">{sidebar}</div></div>
      {open && (
        <>
          <div className="fixed inset-0 z-30 bg-slate-950/40 lg:hidden" onClick={() => setOpen(false)} />
          <div className="fixed inset-y-0 left-0 w-64 z-40 lg:hidden">{sidebar}</div>
        </>
      )}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <button onClick={() => setOpen(true)} className="-ml-1 rounded-md p-1.5 text-slate-500 hover:bg-slate-100 lg:hidden" aria-label="Open menu"><Menu size={20} /></button>
            <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium ${isProd ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-800'}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${isProd ? 'bg-red-500' : 'bg-amber-500'}`} />
              {isProd ? 'Production' : `${(meta.environment ?? 'dev').charAt(0).toUpperCase()}${(meta.environment ?? 'dev').slice(1)}`}
            </span>
            <span className="hidden text-xs text-slate-500 sm:block">Every action here is recorded in the audit log.</span>
          </div>
          <span className="hidden text-xs text-slate-500 sm:block">Signs out after {meta.idleTimeoutMinutes} min idle</span>
        </header>
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  )
}
