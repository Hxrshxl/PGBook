'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Building2, LayoutDashboard, Users, IndianRupee, Zap, BedDouble, Wallet, Inbox, UsersRound,
  FileText, Bell, MessageSquare, BarChart3, History, Settings, LogOut, X, ScrollText,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useAppData } from '@/context/AppContext'

// Each item shows only if the signed-in role has the capability.
const navItems = [
  { label: 'Overview',         icon: LayoutDashboard, path: '/dashboard',            exact: true, capability: 'dashboard.view' },
  { label: 'Approvals',        icon: Inbox,           path: '/dashboard/approvals',  capability: 'approvals.view', badge: true },
  { label: 'Tenant Roster',    icon: Users,           path: '/dashboard/tenants',    capability: 'tenants.view' },
  { label: 'Rooms & Beds',     icon: BedDouble,       path: '/dashboard/rooms',      capability: 'rooms.view' },
  { label: 'Rent Tracker',     icon: IndianRupee,     path: '/dashboard/rent',       capability: 'rent.view' },
  { label: 'Utility Splitter', icon: Zap,             path: '/dashboard/utilities',  capability: 'bills.view' },
  { label: 'Expenses',         icon: Wallet,          path: '/dashboard/expenses',   capability: 'expenses.view' },
  { label: 'Receipts',         icon: FileText,        path: '/dashboard/receipts',   capability: 'rent.view' },
  { label: 'Reminders',        icon: Bell,            path: '/dashboard/reminders',  capability: 'rent.view' },
  { label: 'Complaints',       icon: MessageSquare,   path: '/dashboard/complaints', capability: 'complaints.view' },
  { label: 'Analytics',        icon: BarChart3,       path: '/dashboard/analytics',  capability: 'reports.view' },
  { label: 'Tenant History',   icon: History,         path: '/dashboard/history',    capability: 'tenants.view' },
  { label: 'Team',             icon: UsersRound,      path: '/dashboard/team',       capability: 'team.manage' },
  { label: 'Activity',         icon: ScrollText,      path: '/dashboard/activity',   capability: 'activity.view' },
]

export default function Sidebar({ onClose }) {
  const pathname = usePathname()
  const { user, access, can, logout } = useAuth()
  const { approvals } = useAppData()
  const waiting = (approvals?.counts?.requests ?? 0) + (approvals?.counts?.cash ?? 0)

  async function handleLogout() {
    await logout()
    window.location.assign('/') // full reload clears all in-memory data
  }

  function linkCls(path, exact) {
    const active = exact ? pathname === path : pathname.startsWith(path)
    return `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
      active ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'
    }`
  }

  return (
    <aside className="flex flex-col h-full bg-[#0a0e1a] border-r border-white/5">
      <div className="flex items-center justify-between px-5 h-16 shrink-0 border-b border-white/5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
            <Building2 size={16} className="text-white" />
          </div>
          <span style={{ fontFamily: 'Space Grotesk' }} className="text-white font-bold text-xl tracking-tight">
            PG<span className="text-indigo-400">Book</span>
          </span>
        </div>
        {onClose && (
          <button onClick={onClose} aria-label="Close menu" className="lg:hidden text-slate-500 hover:text-white p-1">
            <X size={18} />
          </button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {navItems.filter(item => can(item.capability)).map(({ label, icon: Icon, path, exact, badge }) => (
          <Link key={path} href={path} onClick={onClose} className={linkCls(path, exact)}>
            <Icon size={17} />
            <span className="flex-1">{label}</span>
            {badge && waiting > 0 && (
              <span className="min-w-5 h-5 px-1.5 rounded-full bg-rose-500 text-white text-xs font-bold flex items-center justify-center">{waiting}</span>
            )}
          </Link>
        ))}
      </nav>

      <div className="px-3 pt-4 pb-4 border-t border-white/5 space-y-0.5">
        <Link href="/dashboard/settings" onClick={onClose} className={linkCls('/dashboard/settings', false)}>
          <Settings size={17} />
          Settings
        </Link>
        {user && (
          <div className="flex items-center gap-3 px-3 py-2.5 mt-2">
            <div className="w-8 h-8 rounded-full bg-indigo-900 flex items-center justify-center text-indigo-300 text-xs font-bold shrink-0">
              {user.name?.[0]?.toUpperCase() ?? 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-semibold truncate">{user.name}</p>
              <p className="text-slate-500 text-xs truncate">{access?.role === 'owner' ? user.email : `${access?.roleLabel} · ${access?.org?.ownerName}`}</p>
            </div>
            <button onClick={handleLogout} title="Sign out" aria-label="Sign out" className="text-slate-500 hover:text-red-400 transition-colors shrink-0">
              <LogOut size={15} />
            </button>
          </div>
        )}
      </div>
    </aside>
  )
}
