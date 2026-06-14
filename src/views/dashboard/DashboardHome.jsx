'use client'
import Link from 'next/link'
import { TrendingUp, IndianRupee, Users, AlertCircle, ArrowRight, Bell, MessageSquare } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useAppData } from '@/context/AppContext'
import {
  getCurrentMonth, formatCurrency, formatMonth,
  getActiveTenants, getMonthPayments, getTotalDue, getBalance, timeAgo,
} from '@/utils/helpers'
import Badge from '@/components/ui/Badge'

const quickActions = [
  { label: 'Add Tenant',        path: '/dashboard/tenants',   color: 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200'   },
  { label: 'Record Payment',    path: '/dashboard/rent',      color: 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200' },
  { label: 'Add Utility Bill',  path: '/dashboard/utilities', color: 'bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200'         },
  { label: 'Generate Receipts', path: '/dashboard/receipts',  color: 'bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200'             },
]

export default function DashboardHome() {
  const { user } = useAuth()
  const { tenants, payments, complaints } = useAppData()

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  const currentMonth = getCurrentMonth()
  const activeTenants = getActiveTenants(tenants)
  const monthPayments = getMonthPayments(payments, currentMonth)

  const monthlyRevenue = monthPayments.reduce((sum, p) => sum + (p.amountPaid ?? 0), 0)
  const paidCount = monthPayments.filter(p => p.status === 'paid').length
  const pendingDues = monthPayments.reduce((sum, p) => sum + getBalance(p), 0)
  const openComplaints = complaints.filter(c => c.status === 'open' || c.status === 'in-progress')

  const stats = [
    { label: 'Monthly Revenue', value: formatCurrency(monthlyRevenue), sub: formatMonth(currentMonth),                                    icon: TrendingUp,  color: 'bg-emerald-50 text-emerald-600' },
    { label: 'Rent Collected',  value: `${paidCount} / ${activeTenants.length}`, sub: `${activeTenants.length - paidCount} pending`,    icon: IndianRupee, color: 'bg-indigo-50 text-indigo-600'   },
    { label: 'Active Tenants',  value: activeTenants.length,                     sub: `${tenants.filter(t => t.status === 'vacated').length} vacated`, icon: Users, color: 'bg-blue-50 text-blue-600' },
    { label: 'Pending Dues',    value: formatCurrency(pendingDues),              sub: `${monthPayments.filter(p => p.status !== 'paid').length} tenants pending`, icon: AlertCircle, color: 'bg-amber-50 text-amber-600' },
  ]

  const recentPayments = [...payments]
    .filter(p => p.amountPaid > 0)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 5)
    .map(p => ({ ...p, tenantName: tenants.find(t => t.id === p.tenantId)?.name ?? '—', room: tenants.find(t => t.id === p.tenantId)?.room ?? '—' }))

  const pendingReminders = monthPayments
    .filter(p => p.status !== 'paid')
    .map(p => ({ ...p, tenantName: tenants.find(t => t.id === p.tenantId)?.name ?? '—', room: tenants.find(t => t.id === p.tenantId)?.room ?? '—' }))

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Space Grotesk' }}>
          {greeting}, {user?.name?.split(' ')[0] ?? 'there'} 👋
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Here's what's happening at{' '}
          <span className="font-medium text-slate-700">{user?.pgName ?? 'your PG'}</span> today.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map(({ label, value, sub, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${color}`}>
              <Icon size={18} />
            </div>
            <p className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Space Grotesk' }}>{value}</p>
            <p className="text-slate-400 text-xs mt-0.5">{sub}</p>
            <p className="text-slate-500 text-xs font-medium mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="mb-8">
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {quickActions.map(({ label, path, color }) => (
            <Link
              key={path}
              href={path}
              className={`flex items-center justify-center gap-2 border rounded-xl px-4 py-3 text-sm font-medium transition-colors ${color}`}
            >
              {label}
              <ArrowRight size={14} />
            </Link>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent payments */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-50">
            <h2 className="font-semibold text-slate-900 text-sm">Recent Payments</h2>
            <Link href="/dashboard/rent" className="text-indigo-600 text-xs font-medium hover:text-indigo-700 flex items-center gap-1">
              View all <ArrowRight size={12} />
            </Link>
          </div>
          {recentPayments.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-10">No payments recorded yet.</p>
          ) : (
            <div className="divide-y divide-slate-50">
              {recentPayments.map((p) => (
                <div key={p.id} className="flex items-center justify-between px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-xs font-bold shrink-0">
                      {p.tenantName[0]}
                    </div>
                    <div>
                      <p className="text-slate-900 text-sm font-medium">{p.tenantName}</p>
                      <p className="text-slate-400 text-xs">{p.room} · {timeAgo(p.createdAt)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-900 text-sm font-semibold">{formatCurrency(p.amountPaid)}</span>
                    <Badge status={p.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Pending reminders */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-50">
              <h2 className="font-semibold text-slate-900 text-sm flex items-center gap-2">
                <Bell size={14} className="text-amber-500" />
                Pending Reminders
              </h2>
              <Link href="/dashboard/reminders" className="text-indigo-600 text-xs font-medium hover:text-indigo-700">
                Send all →
              </Link>
            </div>
            {pendingReminders.length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-6">All rents collected this month! 🎉</p>
            ) : (
              <div className="divide-y divide-slate-50">
                {pendingReminders.slice(0, 4).map((p) => (
                  <div key={p.id} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <p className="text-slate-900 text-sm font-medium">{p.tenantName}</p>
                      <p className="text-slate-400 text-xs">{p.room} · Due {formatCurrency(getTotalDue(p))}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge status={p.status} />
                      <Link href="/dashboard/reminders" className="text-xs text-indigo-600 hover:text-indigo-700 font-medium">
                        Remind
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Open complaints */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-50">
              <h2 className="font-semibold text-slate-900 text-sm flex items-center gap-2">
                <MessageSquare size={14} className="text-red-500" />
                Open Complaints
                {openComplaints.length > 0 && (
                  <span className="w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center font-bold">
                    {openComplaints.length}
                  </span>
                )}
              </h2>
              <Link href="/dashboard/complaints" className="text-indigo-600 text-xs font-medium hover:text-indigo-700">
                View all →
              </Link>
            </div>
            {openComplaints.length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-6">No open issues. 👍</p>
            ) : (
              <div className="divide-y divide-slate-50">
                {openComplaints.slice(0, 3).map((c) => (
                  <div key={c.id} className="flex items-start justify-between px-5 py-3">
                    <div className="flex-1 min-w-0 mr-3">
                      <p className="text-slate-900 text-sm font-medium truncate">
                        {c.description.length > 45 ? c.description.slice(0, 45) + '…' : c.description}
                      </p>
                      <p className="text-slate-400 text-xs mt-0.5">{c.tenantName} · {c.room}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Badge status={c.priority} />
                      <Badge status={c.status} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
