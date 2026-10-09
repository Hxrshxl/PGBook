'use client'
import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Search, History, ArrowLeft, Phone, Mail } from 'lucide-react'
import { useAppData } from '@/context/AppContext'
import {
  formatCurrency, formatMonth, formatDate, getTenantPayments, getTotalDue, getBalance, getPaymentEntries,
  initials, PAYMENT_METHOD_LABELS,
} from '@/utils/helpers'
import Badge from '@/components/ui/Badge'
import EmptyState from '@/components/ui/EmptyState'

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

  return (
    <div className="flex h-full overflow-hidden">
      {/* Tenant list — full width on mobile until a tenant is chosen */}
      <div className={`${selected ? 'hidden md:flex' : 'flex'} w-full md:w-72 shrink-0 border-r border-slate-100 bg-white flex-col`}>
        <div className="p-4 border-b border-slate-100">
          <h1 className="text-lg font-bold text-slate-900 mb-3">Tenant History</h1>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              aria-label="Search tenants"
              placeholder="Search tenants…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full border border-slate-200 rounded-xl pl-8 pr-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-400 transition-colors"
            />
          </div>
        </div>
        <div className="overflow-y-auto flex-1">
          {filtered.map(t => (
            <button
              key={t.id}
              onClick={() => setChosenId(t.id)}
              className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors border-b border-slate-50 ${shown?.id === t.id ? 'md:bg-indigo-50 md:border-l-2 md:border-l-indigo-500' : 'hover:bg-slate-50'}`}
            >
              <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-xs font-bold shrink-0">
                {initials(t.name)}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">{t.name}</p>
                <p className="text-xs text-slate-400">Room {t.room}</p>
              </div>
              <span className={`ml-auto text-xs font-medium px-1.5 py-0.5 rounded-full shrink-0 ${t.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                {t.status === 'active' ? 'Active' : 'Vacated'}
              </span>
            </button>
          ))}
          {filtered.length === 0 && <p className="text-center text-slate-400 text-sm py-8">{tenants.length ? 'No tenants found' : 'No tenants yet'}</p>}
        </div>
      </div>

      {/* Detail panel */}
      <div className={`${selected ? 'block' : 'hidden md:block'} flex-1 overflow-y-auto bg-slate-50`}>
        {!shown ? (
          <div className="flex items-center justify-center h-full">
            <EmptyState icon={History} title="No tenants yet" message="Add tenants to see their payment and complaint history here." />
          </div>
        ) : (
          <div className="p-4 sm:p-6 max-w-3xl space-y-6">
            <button onClick={() => setChosenId(null)} className="md:hidden flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700">
              <ArrowLeft size={15} /> All tenants
            </button>

            <div className="bg-white rounded-2xl border border-slate-100 p-5 sm:p-6 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-5">
                <div className="w-14 h-14 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-xl font-bold shrink-0">
                  {initials(shown.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-xl font-bold text-slate-900">{shown.name}</h2>
                    <Badge status={shown.status} />
                  </div>
                  <p className="text-slate-500 text-sm mt-0.5">Room {shown.room} · {formatCurrency(shown.rentAmount)}/mo{shown.depositAmount > 0 && ` · Deposit ${formatCurrency(shown.depositAmount)}`}</p>
                  <p className="text-slate-400 text-xs mt-1">
                    Moved in: {formatDate(shown.moveInDate)}
                    {shown.moveOutDate && ` · Vacated: ${formatDate(shown.moveOutDate)}`}
                  </p>
                </div>
                <div className="sm:text-right shrink-0">
                  <p className="text-xl font-bold text-emerald-600">{formatCurrency(totalPaid)}</p>
                  <p className="text-xs text-slate-400 mt-0.5">Total paid (all time)</p>
                  {totalOutstanding > 0 && <p className="text-xs font-medium text-amber-600 mt-1">{formatCurrency(totalOutstanding)} outstanding</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 mt-5 pt-5 border-t border-slate-100 text-sm">
                <a href={`tel:${shown.phone}`} className="flex items-center gap-2 text-slate-600 hover:text-indigo-600"><Phone size={14} /> {shown.phone}</a>
                {shown.email && <a href={`mailto:${shown.email}`} className="flex items-center gap-2 text-slate-600 hover:text-indigo-600 truncate"><Mail size={14} /> {shown.email}</a>}
                {shown.idNumber && <p className="text-slate-500">{ID_LABELS[shown.idType] ?? 'ID'}: <span className="text-slate-700">{shown.idNumber}</span></p>}
                {shown.emergencyContact?.name && (
                  <p className="text-slate-500">Emergency: <span className="text-slate-700">{shown.emergencyContact.name}{shown.emergencyContact.relation && ` (${shown.emergencyContact.relation})`}{shown.emergencyContact.phone && ` · ${shown.emergencyContact.phone}`}</span></p>
                )}
                {shown.notes && <p className="text-slate-500 sm:col-span-2">Notes: <span className="text-slate-700 whitespace-pre-wrap">{shown.notes}</span></p>}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 sm:gap-4">
              {[
                { label: 'Months billed',    value: tenantPayments.length },
                { label: 'Fully paid',       value: tenantPayments.filter(p => p.status === 'paid').length },
                { label: 'Complaints filed', value: tenantComplaints.length },
              ].map(s => (
                <div key={s.label} className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm text-center">
                  <p className="text-2xl font-bold text-slate-900">{s.value}</p>
                  <p className="text-slate-500 text-xs mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100">
                <h3 className="font-semibold text-slate-900">Payment History</h3>
              </div>
              {tenantPayments.length === 0 ? (
                <p className="text-center text-slate-400 text-sm py-8">No dues recorded yet</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[620px]">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100">
                        {['Month', 'Rent', 'Utility', 'Total', 'Paid', 'Balance', 'Status'].map((h, i) => (
                          <th key={h} scope="col" className={`px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider ${i === 0 ? 'text-left' : 'text-right'}`}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {tenantPayments.map(p => {
                        const entries = getPaymentEntries(p)
                        return (
                          <tr key={p.id} className="hover:bg-slate-50/50 transition-colors align-top">
                            <td className="px-4 py-3">
                              <p className="font-medium text-slate-900">{formatMonth(p.month)}</p>
                              {entries.map(e => (
                                <p key={e.id} className="text-xs text-slate-400">{formatDate(e.date)} · {formatCurrency(e.amount)} · {PAYMENT_METHOD_LABELS[e.method] ?? e.method}</p>
                              ))}
                            </td>
                            <td className="px-4 py-3 text-right text-slate-600">{formatCurrency(p.rentAmount)}</td>
                            <td className="px-4 py-3 text-right text-slate-600">{formatCurrency(p.utilityShare ?? 0)}</td>
                            <td className="px-4 py-3 text-right font-semibold text-slate-900">{formatCurrency(getTotalDue(p))}</td>
                            <td className="px-4 py-3 text-right text-emerald-600 font-medium">{formatCurrency(p.amountPaid ?? 0)}</td>
                            <td className="px-4 py-3 text-right text-amber-600">{formatCurrency(getBalance(p))}</td>
                            <td className="px-4 py-3 text-right"><Badge status={p.status} /></td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {tenantComplaints.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100">
                  <h3 className="font-semibold text-slate-900">Complaint History</h3>
                </div>
                <div className="divide-y divide-slate-50">
                  {tenantComplaints.map(c => (
                    <div key={c.id} className="px-5 py-4 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm text-slate-900 break-words">{c.description}</p>
                        <p className="text-xs text-slate-400 mt-1 capitalize">{c.category} · {formatDate(c.createdAt)}</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Badge status={c.priority} />
                        <Badge status={c.status} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
