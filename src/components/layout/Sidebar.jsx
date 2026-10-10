'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Users, IndianRupee, Zap, BedDouble, Wallet, Inbox, UsersRound,
  FileText, Bell, MessageSquare, BarChart3, History, Settings, LogOut, X, ScrollText, CreditCard, Megaphone, PiggyBank,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useAppData } from '@/context/AppContext'
import { initials } from '@/utils/helpers'
import Logo from '@/components/ui/Logo'

// Grouped by the job the owner is doing. Each item shows only if the role has the capability.
const SECTIONS = [
  {
    items: [
      { label: 'Overview',       icon: LayoutDashboard, path: '/dashboard', exact: true, capability: 'dashboard.view' },
      { label: 'Approvals',      icon: Inbox,           path: '/dashboard/approvals',  capability: 'approvals.view', badge: true },
    ],
  },
  {
    label: 'Property',
    items: [
      { label: 'Tenants',        icon: Users,           path: '/dashboard/tenants',    capability: 'tenants.view' },
      { label: 'Rooms',          icon: BedDouble,       path: '/dashboard/rooms',      capability: 'rooms.view' },
      { label: 'Complaints',     icon: MessageSquare,   path: '/dashboard/complaints', capability: 'complaints.view' },
      { label: 'Notices',        icon: Megaphone,       path: '/dashboard/notices',    capability: 'notices.view' },
    ],
  },
  {
    label: 'Money',
    items: [
      { label: 'Rent',           icon: IndianRupee,     path: '/dashboard/rent',       capability: 'rent.view' },
      { label: 'Utility bills',  icon: Zap,             path: '/dashboard/utilities',  capability: 'bills.view' },
      { label: 'Expenses',       icon: Wallet,          path: '/dashboard/expenses',   capability: 'expenses.view' },
      { label: 'Deposits',       icon: PiggyBank,       path: '/dashboard/deposits',   capability: 'deposits.view' },
      { label: 'Receipts',       icon: FileText,        path: '/dashboard/receipts',   capability: 'rent.view' },
      { label: 'Reminders',      icon: Bell,            path: '/dashboard/reminders',  capability: 'rent.view' },
    ],
  },
  {
    label: 'Insights',
    items: [
      { label: 'Analytics',      icon: BarChart3,       path: '/dashboard/analytics',  capability: 'reports.view' },
      { label: 'Tenant history', icon: History,         path: '/dashboard/history',    capability: 'tenants.view' },
      { label: 'Activity',       icon: ScrollText,      path: '/dashboard/activity',   capability: 'activity.view' },
    ],
  },
  {
    label: 'Account',
    items: [
      { label: 'Team',           icon: UsersRound,      path: '/dashboard/team',       capability: 'team.manage' },
      { label: 'Subscription',   icon: CreditCard,      path: '/dashboard/billing',    capability: 'billing.manage' },
      { label: 'Settings',       icon: Settings,        path: '/dashboard/settings' },
    ],
  },
]

export default function Sidebar({ onClose }) {
  const pathname = usePathname()
  const { user, access, can, logout } = useAuth()
  const { approvals } = useAppData()
  const c = approvals?.counts ?? {}
  const waiting = (c.requests ?? 0) + (c.cash ?? 0) + (c.claims ?? 0) + (c.moveOuts ?? 0) + (c.settlements ?? 0)

  async function handleLogout() {
    await logout()
    window.location.assign('/') // full reload clears all in-memory data
  }

  const isActive = (path, exact) => (exact ? pathname === path : pathname === path || pathname.startsWith(`${path}/`))

  return (
    <aside className="flex h-full flex-col border-r border-slate-200 bg-slate-50">
      <div className="flex h-14 shrink-0 items-center justify-between px-4">
        <Link href="/dashboard" onClick={onClose} className="flex items-center"><Logo /></Link>
        {onClose && (
          <button onClick={onClose} aria-label="Close menu" className="lg:hidden inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-200/60">
            <X size={16} />
          </button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-4" aria-label="Main">
        {SECTIONS.map((section, si) => {
          const items = section.items.filter(item => !item.capability || can(item.capability))
          if (!items.length) return null
          return (
            <div key={section.label ?? si} className={si ? 'mt-5' : 'mt-1'}>
              {section.label && <p className="mb-1 px-2.5 text-[11px] font-medium uppercase tracking-wider text-slate-400">{section.label}</p>}
              <ul className="space-y-px">
                {items.map(({ label, icon: Icon, path, exact, badge }) => {
                  const active = isActive(path, exact)
                  return (
                    <li key={path}>
                      <Link
                        href={path}
                        onClick={onClose}
                        aria-current={active ? 'page' : undefined}
                        className={`group flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[13px] transition-colors ${active ? 'bg-white text-slate-900 font-medium shadow-xs ring-1 ring-slate-200' : 'text-slate-600 hover:bg-slate-200/50 hover:text-slate-900'}`}
                      >
                        <Icon size={15} strokeWidth={1.75} className={active ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-600'} />
                        <span className="flex-1 truncate">{label}</span>
                        {badge && waiting > 0 && (
                          <span className="min-w-5 rounded-full bg-indigo-600 px-1.5 text-center text-[11px] font-medium leading-5 text-white tabular-nums">{waiting}</span>
                        )}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        })}
      </nav>

      {user && (
        <div className="shrink-0 border-t border-slate-200 p-3">
          <div className="flex items-center gap-2.5 rounded-md px-1.5 py-1">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-medium text-slate-700">{initials(user.name)}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-slate-900">{user.name}</p>
              <p className="truncate text-xs text-slate-500">{access?.role === 'owner' ? user.email : `${access?.roleLabel} · ${access?.org?.ownerName}`}</p>
            </div>
            <button onClick={handleLogout} title="Sign out" aria-label="Sign out" className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-slate-200/60 hover:text-slate-700">
              <LogOut size={15} />
            </button>
          </div>
        </div>
      )}
    </aside>
  )
}
