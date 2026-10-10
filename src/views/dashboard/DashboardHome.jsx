'use client'
import Link from 'next/link'
import { ArrowRight, ChevronRight } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useAppData } from '@/context/AppContext'
import {
  getCurrentMonth, formatCurrency, formatCurrencyRounded, formatDate, getActiveTenants, getMonthPayments, getBalance,
  getPaymentEntries, isBillableMonth, PAYMENT_METHOD_LABELS, chargesTotal, receivedInMonth, roundMoney, timeAgo,
} from '@/utils/helpers'
import Badge from '@/components/ui/Badge'
import StatStrip from '@/components/ui/StatStrip'
import { btn, page } from '@/components/ui/styles'

function Panel({ title, action, children }) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-3">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

const panelLink = 'inline-flex items-center gap-0.5 text-[13px] font-medium text-slate-500 hover:text-slate-900'

export default function DashboardHome() {
  const { can } = useAuth()
  const { tenants, payments, complaints, expenses, rooms, approvals, properties, currentProperty, pgSettings } = useAppData()
  const counts = approvals?.counts ?? {}
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })
  const placeName = currentProperty?.name ?? (properties.length > 1 ? `All ${properties.length} properties` : pgSettings.pgName || 'Your PG')

  const currentMonth = getCurrentMonth()
  const tenantById = new Map(tenants.map(t => [t.id, t]))
  const activeTenants = getActiveTenants(tenants)
  const billable = activeTenants.filter(t => isBillableMonth(t.moveInDate, currentMonth))
  const monthPayments = getMonthPayments(payments, currentMonth)
  const paymentByTenant = new Map(monthPayments.map(p => [p.tenantId, p]))

  const collected = monthPayments.reduce((sum, p) => sum + (p.amountPaid ?? 0), 0)
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
  ]
    .map(r => ({ ...r, balance: r.payment ? getBalance(r.payment) : r.tenant.rentAmount + chargesTotal(r.tenant.recurringCharges) }))
    .sort((a, b) => b.balance - a.balance)
  const outstanding = pending.reduce((s, r) => s + r.balance, 0)
  const openComplaints = complaints.filter(c => c.status !== 'resolved').sort((a, b) => ({ high: 0, medium: 1, low: 2 }[a.priority] - { high: 0, medium: 1, low: 2 }[b.priority]))
  const beds = rooms.length ? rooms.reduce((s, r) => s + r.capacity, 0) : pgSettings.totalBeds
  const showMoney = can('expenses.view')
  const received = receivedInMonth(payments, currentMonth)
  const spent = roundMoney(expenses.filter(e => e.month === currentMonth).reduce((s, e) => s + e.amount, 0))
  const net = roundMoney(received - spent)

  const recentPayments = payments
    .flatMap(p => getPaymentEntries(p).map(e => ({ ...e, payment: p, tenant: tenantById.get(p.tenantId) })))
    .filter(e => e.tenant)
    .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '') || new Date(b.createdAt ?? 0) - new Date(a.createdAt ?? 0))
    .slice(0, 6)

  const setupProperty = can('settings.manage') ? (currentProperty ? [currentProperty] : properties).find(p => !p.name || !p.upiId) : null

  // What needs a decision today, in order of importance.
  const attention = [
    counts.claims > 0 && { label: `${counts.claims} payment${counts.claims === 1 ? '' : 's'} reported by tenants`, href: '/dashboard/approvals' },
    counts.cash > 0 && { label: `${formatCurrencyRounded(counts.pendingCashAmount)} cash to confirm`, href: '/dashboard/approvals' },
    counts.requests > 0 && { label: `${counts.requests} staff request${counts.requests === 1 ? '' : 's'}`, href: '/dashboard/approvals' },
    counts.moveOuts > 0 && { label: `${counts.moveOuts} move-out notice${counts.moveOuts === 1 ? '' : 's'}`, href: '/dashboard/approvals' },
    counts.settlements > 0 && { label: `${counts.settlements} deposit settlement${counts.settlements === 1 ? '' : 's'} to approve`, href: '/dashboard/approvals' },
    setupProperty && { label: `Add ${!setupProperty.upiId ? 'a UPI ID' : 'a PG name'} for ${setupProperty.name || 'your PG'}`, href: '/dashboard/settings' },
  ].filter(Boolean)

  const stats = [
    { label: 'Collected', value: formatCurrencyRounded(collected), sub: `${paidCount} of ${billable.length} paid this month` },
    { label: 'Outstanding', value: formatCurrencyRounded(outstanding), sub: `${pending.length} tenant${pending.length === 1 ? '' : 's'}`, tone: outstanding > 0 ? 'warning' : 'default' },
    { label: 'Occupancy', value: beds ? `${Math.round((activeTenants.length / beds) * 100)}%` : activeTenants.length, sub: beds ? `${activeTenants.length} of ${beds} beds · ${Math.max(0, beds - activeTenants.length)} free` : 'active tenants' },
    showMoney
      ? { label: 'Net this month', value: `${net < 0 ? '−' : ''}${formatCurrencyRounded(Math.abs(net))}`, sub: `${formatCurrencyRounded(spent)} spent so far`, tone: net < 0 ? 'negative' : 'default' }
      : { label: 'Open complaints', value: openComplaints.length, sub: `${openComplaints.filter(c => c.priority === 'high').length} high priority` },
  ]

  return (
    <div className={`${page} mx-auto max-w-6xl`}>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[13px] text-slate-500">{today}</p>
          <h1 className="mt-0.5 text-xl font-semibold tracking-tight text-slate-900">{placeName}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {can('tenants.manage') && <Link href="/dashboard/tenants" className={btn.secondary}>Add tenant</Link>}
          {can('rent.record')
            ? <Link href="/dashboard/rent" className={btn.primary}>Record payment</Link>
            : can('cash.collect') && <Link href="/dashboard/rent" className={btn.primary}>Collect cash</Link>}
        </div>
      </div>

      {attention.length > 0 && (
        <div className="mb-6 overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center gap-2 border-b border-slate-200 px-5 py-2.5">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            <h2 className="text-[13px] font-semibold text-slate-900">Needs your attention</h2>
          </div>
          <ul className="divide-y divide-slate-100">
            {attention.map(item => (
              <li key={item.label}>
                <Link href={item.href} className="group flex items-center justify-between gap-3 px-5 py-2.5 text-sm text-slate-700 hover:bg-slate-50">
                  {item.label}
                  <ChevronRight size={15} className="text-slate-300 group-hover:text-slate-500" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <StatStrip items={stats} className="mb-6" />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        <div className="xl:col-span-3">
          <Panel
            title={`Unpaid this month`}
            action={<Link href="/dashboard/reminders" className={panelLink}>Send reminders <ChevronRight size={14} /></Link>}
          >
            {pending.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-slate-500">{billable.length ? 'Everyone has paid for this month.' : 'No tenants yet.'}</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500">
                    <th scope="col" className="px-5 py-2 font-medium">Tenant</th>
                    <th scope="col" className="hidden sm:table-cell px-3 py-2 font-medium">Room</th>
                    <th scope="col" className="px-3 py-2 font-medium">Status</th>
                    <th scope="col" className="px-5 py-2 text-right font-medium">Due</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 border-t border-slate-100">
                  {pending.slice(0, 7).map(({ tenant, payment, balance }) => (
                    <tr key={tenant.id} className="hover:bg-slate-50">
                      <td className="px-5 py-2.5">
                        <Link href={`/dashboard/history?tenantId=${tenant.id}`} className="font-medium text-slate-900 hover:underline">{tenant.name}</Link>
                        <span className="sm:hidden text-xs text-slate-500"> · {tenant.room}</span>
                      </td>
                      <td className="hidden sm:table-cell whitespace-nowrap px-3 py-2.5 text-slate-600">{tenant.room}</td>
                      <td className="px-3 py-2.5"><Badge status={payment?.status ?? 'pending'} /></td>
                      <td className="whitespace-nowrap px-5 py-2.5 text-right font-medium text-slate-900">{formatCurrency(balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {pending.length > 7 && (
              <Link href="/dashboard/rent" className="flex items-center justify-center gap-1 border-t border-slate-100 py-2.5 text-[13px] font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-900">
                View all {pending.length} in Rent <ArrowRight size={13} />
              </Link>
            )}
          </Panel>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:col-span-2 xl:grid-cols-1 xl:content-start">
          <Panel title="Recent payments" action={<Link href="/dashboard/rent" className={panelLink}>Rent <ChevronRight size={14} /></Link>}>
            {recentPayments.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-slate-500">No payments recorded yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {recentPayments.map(e => (
                  <li key={e.id} className="flex items-center justify-between gap-3 px-5 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm text-slate-900">{e.tenant.name}</p>
                      <p className="truncate text-xs text-slate-500">{formatDate(e.date)} · {PAYMENT_METHOD_LABELS[e.method] ?? e.method}</p>
                    </div>
                    <span className="shrink-0 text-sm font-medium tabular-nums text-slate-900">{formatCurrency(e.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {can('complaints.view') && (
            <Panel title="Open complaints" action={<Link href="/dashboard/complaints" className={panelLink}>All <ChevronRight size={14} /></Link>}>
              {openComplaints.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-slate-500">No open complaints.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {openComplaints.slice(0, 4).map(c => (
                    <li key={c.id} className="px-5 py-2.5">
                      <div className="flex items-start justify-between gap-3">
                        <p className="line-clamp-1 text-sm text-slate-900">{c.description}</p>
                        <Badge status={c.priority} />
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500">{c.tenantName} · {c.room} · {timeAgo(c.createdAt)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          )}
        </div>
      </div>
    </div>
  )
}
