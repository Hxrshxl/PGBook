'use client'
import Link from 'next/link'
import { TrendingUp, IndianRupee, Users, AlertCircle, ArrowRight, Bell, MessageSquare, Settings } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useAppData } from '@/context/AppContext'
import {
  getCurrentMonth, formatCurrency, formatCurrencyRounded, formatMonth, formatDate, getActiveTenants, getMonthPayments, getBalance,
  getPaymentEntries, isBillableMonth, PAYMENT_METHOD_LABELS,
} from '@/utils/helpers'
import Badge from '@/components/ui/Badge'

const quickActions = [
  { label: 'Add Tenant',        path: '/dashboard/tenants',   color: 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200'    },
  { label: 'Record Payment',    path: '/dashboard/rent',      color: 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200' },
  { label: 'Add Utility Bill',  path: '/dashboard/utilities', color: 'bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200'          },
  { label: 'Generate Receipts', path: '/dashboard/receipts',  color: 'bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200'              },
]

export default function DashboardHome() {
  const { user } = useAuth()
  const { tenants, payments, complaints, pgSettings } = useAppData()

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  const currentMonth = getCurrentMonth()
  const tenantById = new Map(tenants.map(t => [t.id, t]))
  const activeTenants = getActiveTenants(tenants)
  const billable = activeTenants.filter(t => isBillableMonth(t.moveInDate, currentMonth))
  const monthPayments = getMonthPayments(payments, currentMonth)
  const paymentByTenant = new Map(monthPayments.map(p => [p.tenantId, p]))

  const monthlyRevenue = monthPayments.reduce((sum, p) => sum + (p.amountPaid ?? 0), 0)
  const paidCount = billable.filter(t => paymentByTenant.get(t.id)?.status === 'paid').length

  // Everyone who still owes for this month: active tenants (with or without dues
  // created yet) plus vacated tenants who left with a balance.
  const pending = [
    ...billable
      .filter(t => paymentByTenant.get(t.id)?.status !== 'paid' && t.rentAmount > 0)
      .map(t => ({ tenant: t, payment: paymentByTenant.get(t.id) ?? null })),
    ...monthPayments
      .filter(p => p.status !== 'paid' && tenantById.get(p.tenantId)?.status === 'vacated')
      .map(p => ({ tenant: tenantById.get(p.tenantId), payment: p })),
  ].map(r => ({ ...r, balance: r.payment ? getBalance(r.payment) : r.tenant.rentAmount }))
  const pendingDues = pending.reduce((s, r) => s + r.balance, 0)
  const openComplaints = complaints.filter(c => c.status !== 'resolved')

  const stats = [
    { label: 'Collected this month', value: formatCurrencyRounded(monthlyRevenue), sub: formatMonth(currentMonth), icon: TrendingUp, color: 'bg-emerald-50 text-emerald-600' },
    { label: 'Paid in full', value: `${paidCount} / ${billable.length}`, sub: `${billable.length - paidCount} not fully paid`, icon: IndianRupee, color: 'bg-indigo-50 text-indigo-600' },
    { label: 'Active tenants', value: activeTenants.length, sub: pgSettings.totalBeds ? `${pgSettings.totalBeds} beds total` : `${tenants.length - activeTenants.length} vacated`, icon: Users, color: 'bg-blue-50 text-blue-600' },
    { label: 'Pending dues', value: formatCurrencyRounded(pendingDues), sub: `${pending.length} tenant(s)`, icon: AlertCircle, color: 'bg-amber-50 text-amber-600' },
  ]

  // Latest individual amounts received, across all months.
  const recentPayments = payments
    .flatMap(p => getPaymentEntries(p).map(e => ({ ...e, payment: p, tenant: tenantById.get(p.tenantId) })))
    .filter(e => e.tenant)
    .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '') || new Date(b.createdAt ?? 0) - new Date(a.createdAt ?? 0))
    .slice(0, 5)

  const needsSetup = !pgSettings.pgName || !pgSettings.upiId

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">
          {greeting}, {user?.name?.split(' ')[0] ?? 'there'} 👋
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Here&apos;s what&apos;s happening at{' '}
          <span className="font-medium text-slate-700">{pgSettings.pgName || 'your PG'}</span> today.
        </p>
      </div>

      {needsSetup && (
        <Link href="/dashboard/settings" className="flex items-center gap-3 bg-indigo-50 border border-indigo-100 rounded-2xl px-5 py-4 mb-6 hover:bg-indigo-100/60 transition-colors">
          <Settings size={18} className="text-indigo-600 shrink-0" />
          <p className="text-sm text-indigo-900 flex-1">
            <span className="font-semibold">Finish setting up:</span> add your {!pgSettings.pgName ? 'PG name' : ''}{!pgSettings.pgName && !pgSettings.upiId ? ' and ' : ''}{!pgSettings.upiId ? 'UPI ID' : ''} so they appear on receipts and reminders.
          </p>
          <ArrowRight size={16} className="text-indigo-600 shrink-0" />
        </Link>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map(({ label, value, sub, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${color}`}>
              <Icon size={18} />
            </div>
            <p className="text-xl sm:text-2xl font-bold text-slate-900">{value}</p>
            <p className="text-slate-400 text-xs mt-0.5">{sub}</p>
            <p className="text-slate-500 text-xs font-medium mt-1">{label}</p>
          </div>
        ))}
      </div>

      <div className="mb-8">
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {quickActions.map(({ label, path, color }) => (
            <Link key={path} href={path} className={`flex items-center justify-center gap-2 border rounded-xl px-3 py-3 text-sm font-medium transition-colors text-center ${color}`}>
              {label}
              <ArrowRight size={14} className="shrink-0" />
            </Link>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
              {recentPayments.map(e => (
                <div key={e.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-xs font-bold shrink-0">
                      {e.tenant.name[0]}
                    </div>
                    <div className="min-w-0">
                      <p className="text-slate-900 text-sm font-medium truncate">{e.tenant.name}</p>
                      <p className="text-slate-400 text-xs truncate">{formatDate(e.date)} · {PAYMENT_METHOD_LABELS[e.method] ?? e.method} · {formatMonth(e.payment.month)}</p>
                    </div>
                  </div>
                  <span className="text-slate-900 text-sm font-semibold shrink-0">{formatCurrency(e.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-50">
              <h2 className="font-semibold text-slate-900 text-sm flex items-center gap-2">
                <Bell size={14} className="text-amber-500" />
                Pending This Month
              </h2>
              <Link href="/dashboard/reminders" className="text-indigo-600 text-xs font-medium hover:text-indigo-700">
                Send reminders →
              </Link>
            </div>
            {pending.length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-6">{billable.length ? 'All rents collected this month! 🎉' : 'No active tenants yet.'}</p>
            ) : (
              <div className="divide-y divide-slate-50">
                {pending.slice(0, 4).map(({ tenant, payment, balance }) => (
                  <div key={tenant.id} className="flex items-center justify-between px-5 py-3">
                    <div className="min-w-0">
                      <p className="text-slate-900 text-sm font-medium truncate">{tenant.name}</p>
                      <p className="text-slate-400 text-xs">Room {tenant.room} · Due {formatCurrency(balance)}</p>
                    </div>
                    <Badge status={payment?.status ?? 'pending'} />
                  </div>
                ))}
                {pending.length > 4 && <p className="text-xs text-slate-400 text-center py-2.5">+{pending.length - 4} more</p>}
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-50">
              <h2 className="font-semibold text-slate-900 text-sm flex items-center gap-2">
                <MessageSquare size={14} className="text-red-500" />
                Open Complaints
                {openComplaints.length > 0 && (
                  <span className="min-w-5 h-5 px-1 rounded-full bg-red-500 text-white text-xs flex items-center justify-center font-bold">
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
                {openComplaints.slice(0, 3).map(c => (
                  <div key={c.id} className="flex items-start justify-between px-5 py-3">
                    <div className="flex-1 min-w-0 mr-3">
                      <p className="text-slate-900 text-sm font-medium truncate">{c.description}</p>
                      <p className="text-slate-400 text-xs mt-0.5">{c.tenantName} · Room {c.room}</p>
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
