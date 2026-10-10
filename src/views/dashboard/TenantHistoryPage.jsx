'use client'
import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { History, ArrowLeft } from 'lucide-react'
import { useAppData } from '@/context/AppContext'
import {
  formatCurrency, formatMonth, formatDate, getTenantPayments, getTotalDue, getBalance, getPaymentEntries,
  PAYMENT_METHOD_LABELS,
} from '@/utils/helpers'
import Badge from '@/components/ui/Badge'
import EmptyState from '@/components/ui/EmptyState'
import SearchInput from '@/components/ui/SearchInput'
import StatStrip from '@/components/ui/StatStrip'
import Panel from '@/components/ui/Panel'

const ID_LABELS = { aadhaar: 'Aadhaar', pan: 'PAN', passport: 'Passport', dl: "Driver's License", voter: 'Voter ID', other: 'ID' }

export default function TenantHistoryPage() {
  const { tenants, payments, complaints } = useAppData()
  const searchParams = useSearchParams()
  const [search, setSearch] = useState('')
  // Explicit choice wins; otherwise the ?tenantId= link; otherwise nothing (list view on mobile).
  const [chosenId, setChosenId] = useState(() => searchParams.get('tenantId'))

  const filtered = tenants
    .filter(t => !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.room.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => (a.status === b.status ? a.name.localeCompare(b.name) : a.status === 'active' ? -1 : 1))

  const selected = tenants.find(t => t.id === chosenId) ?? null
  // On desktop, show the first tenant when nothing is chosen.
  const shown = selected ?? filtered[0] ?? null
  const tenantPayments = shown ? getTenantPayments(payments, shown.id) : []
  const tenantComplaints = shown
    ? complaints.filter(c => c.tenantId === shown.id).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    : []
  const totalPaid = tenantPayments.reduce((s, p) => s + (p.amountPaid ?? 0), 0)
  const totalOutstanding = tenantPayments.reduce((s, p) => s + getBalance(p), 0)

  const th = 'px-3 py-2.5 text-xs font-medium text-slate-500 text-right'
  const details = shown ? [
    ['Phone', <a key="p" href={`tel:${shown.phone}`} className="hover:underline">{shown.phone}</a>],
    shown.email && ['Email', <a key="e" href={`mailto:${shown.email}`} className="hover:underline">{shown.email}</a>],
    ['Moved in', formatDate(shown.moveInDate)],
    shown.moveOutDate && ['Moved out', formatDate(shown.moveOutDate)],
    shown.depositAmount > 0 && ['Deposit', formatCurrency(shown.depositAmount)],
    shown.idNumber && [ID_LABELS[shown.idType] ?? 'ID', shown.idNumber],
    shown.emergencyContact?.name && ['Emergency contact', `${shown.emergencyContact.name}${shown.emergencyContact.relation ? ` (${shown.emergencyContact.relation})` : ''}${shown.emergencyContact.phone ? ` · ${shown.emergencyContact.phone}` : ''}`],
    shown.notes && ['Notes', <span key="n" className="whitespace-pre-wrap">{shown.notes}</span>],
  ].filter(Boolean) : []

  return (
    <div className="flex h-full overflow-hidden">
      {/* Tenant list — full width on mobile until a tenant is chosen */}
      <div className={`${selected ? 'hidden md:flex' : 'flex'} w-full shrink-0 flex-col border-r border-slate-200 bg-white md:w-72`}>
        <div className="border-b border-slate-200 p-4">
          <h1 className="mb-3 text-base font-semibold text-slate-900">Tenant history</h1>
          <SearchInput value={search} onChange={setSearch} placeholder="Search tenants" label="Search tenants" className="w-full" />
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {filtered.map(t => {
            const active = shown?.id === t.id
            return (
              <button
                key={t.id}
                onClick={() => setChosenId(t.id)}
                className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors ${active ? 'md:bg-slate-100' : 'hover:bg-slate-50'}`}
              >
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-sm ${active ? 'font-medium text-slate-900' : 'text-slate-800'}`}>{t.name}</p>
                  <p className="text-xs text-slate-500">Room {t.room}</p>
                </div>
                {t.status !== 'active' && <span className="shrink-0 text-xs text-slate-400">Moved out</span>}
              </button>
            )
          })}
          {filtered.length === 0 && <p className="py-8 text-center text-sm text-slate-500">{tenants.length ? 'No tenants found' : 'No tenants yet'}</p>}
        </div>
      </div>

      {/* Detail panel */}
      <div className={`${selected ? 'block' : 'hidden md:block'} flex-1 overflow-y-auto`}>
        {!shown ? (
          <div className="flex h-full items-center justify-center p-6">
            <EmptyState icon={History} title="No tenants yet" message="Add tenants to see their payment and complaint history here." />
          </div>
        ) : (
          <div className="max-w-4xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
            <button onClick={() => setChosenId(null)} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 md:hidden">
              <ArrowLeft size={15} /> All tenants
            </button>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-semibold tracking-tight text-slate-900">{shown.name}</h2>
                <Badge status={shown.status} />
              </div>
              <p className="mt-1 text-sm text-slate-500">Room {shown.room} · {formatCurrency(shown.rentAmount)} a month</p>
            </div>

            <StatStrip items={[
              { label: 'Paid, all time', value: formatCurrency(totalPaid) },
              { label: 'Outstanding', value: totalOutstanding > 0 ? formatCurrency(totalOutstanding) : '—', tone: totalOutstanding > 0 ? 'warning' : 'muted' },
              { label: 'Months billed', value: tenantPayments.length, sub: `${tenantPayments.filter(p => p.status === 'paid').length} paid in full` },
              { label: 'Complaints', value: tenantComplaints.length },
            ]} />

            <Panel title="Details">
              <dl className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
                {details.map(([label, value]) => (
                  <div key={label} className="flex gap-3 border-b border-slate-100 px-5 py-2.5 text-sm">
                    <dt className="w-32 shrink-0 text-slate-500">{label}</dt>
                    <dd className="min-w-0 break-words text-slate-900">{value}</dd>
                  </div>
                ))}
              </dl>
            </Panel>

            <Panel title="Payments">
              {tenantPayments.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-500">No dues recorded yet</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[620px] text-sm">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th scope="col" className="py-2.5 pl-5 pr-3 text-left text-xs font-medium text-slate-500">Month</th>
                        <th scope="col" className={th}>Rent</th>
                        <th scope="col" className={th}>Utilities</th>
                        <th scope="col" className={th}>Total</th>
                        <th scope="col" className={th}>Paid</th>
                        <th scope="col" className={th}>Balance</th>
                        <th scope="col" className="py-2.5 pl-3 pr-5 text-left text-xs font-medium text-slate-500">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {tenantPayments.map(p => {
                        const entries = getPaymentEntries(p)
                        const balance = getBalance(p)
                        return (
                          <tr key={p.id} className="align-top hover:bg-slate-50/70">
                            <td className="py-2.5 pl-5 pr-3">
                              <p className="font-medium text-slate-900">{formatMonth(p.month)}</p>
                              {entries.map(e => (
                                <p key={e.id} className="text-xs text-slate-500">{formatDate(e.date)} · {formatCurrency(e.amount)} · {PAYMENT_METHOD_LABELS[e.method] ?? e.method}</p>
                              ))}
                            </td>
                            <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">{formatCurrency(p.rentAmount)}</td>
                            <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">{p.utilityShare ? formatCurrency(p.utilityShare) : <span className="text-slate-300">—</span>}</td>
                            <td className="px-3 py-2.5 text-right font-medium tabular-nums text-slate-900">{formatCurrency(getTotalDue(p))}</td>
                            <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">{formatCurrency(p.amountPaid ?? 0)}</td>
                            <td className="px-3 py-2.5 text-right tabular-nums text-slate-900">{balance > 0 ? formatCurrency(balance) : <span className="text-slate-300">—</span>}</td>
                            <td className="py-2.5 pl-3 pr-5"><Badge status={p.status} /></td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>

            {tenantComplaints.length > 0 && (
              <Panel title="Complaints">
                <ul className="divide-y divide-slate-100">
                  {tenantComplaints.map(c => (
                    <li key={c.id} className="flex items-start justify-between gap-3 px-5 py-3">
                      <div className="min-w-0">
                        <p className="break-words text-sm text-slate-900">{c.description}</p>
                        <p className="mt-0.5 text-xs capitalize text-slate-500">{c.category} · {formatDate(c.createdAt)}</p>
                      </div>
                      <Badge status={c.status} />
                    </li>
                  ))}
                </ul>
              </Panel>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
