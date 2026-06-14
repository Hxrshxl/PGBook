'use client'
import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Search, History } from 'lucide-react'
import { useAppData } from '@/context/AppContext'
import { formatCurrency, formatMonth, getTenantPayments, getTotalDue, getBalance, initials } from '@/utils/helpers'
import Badge from '@/components/ui/Badge'
import EmptyState from '@/components/ui/EmptyState'

export default function TenantHistoryPage() {
  const { tenants, payments, complaints } = useAppData()
  const searchParams = useSearchParams()
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState(null)

  // Pre-select tenant from query param (?tenantId=xxx)
  useEffect(() => {
    const tid = searchParams.get('tenantId')
    if (tid) setSelectedId(tid)
    else if (tenants.length) setSelectedId(tenants[0].id)
  }, [])

  const filtered = tenants.filter(t =>
    !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.room.toLowerCase().includes(search.toLowerCase())
  )

  const selected = tenants.find(t => t.id === selectedId) ?? null
  const tenantPayments = selected ? getTenantPayments(payments, selected.id) : []
  const tenantComplaints = selected ? complaints.filter(c => c.tenantId === selected.id).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)) : []
  const totalPaid = tenantPayments.reduce((s, p) => s + (p.amountPaid ?? 0), 0)

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden">
      {/* Sidebar — tenant list */}
      <div className="w-72 shrink-0 border-r border-slate-100 bg-white flex flex-col">
        <div className="p-4 border-b border-slate-100">
          <h1 className="text-lg font-bold text-slate-900 mb-3" style={{ fontFamily: 'Space Grotesk' }}>Tenant History</h1>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
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
              onClick={() => setSelectedId(t.id)}
              className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors border-b border-slate-50 ${selectedId === t.id ? 'bg-indigo-50 border-l-2 border-l-indigo-500' : 'hover:bg-slate-50'}`}
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
          {filtered.length === 0 && <p className="text-center text-slate-400 text-sm py-8">No tenants found</p>}
        </div>
      </div>

      {/* Main panel */}
      <div className="flex-1 overflow-y-auto bg-slate-50">
        {!selected ? (
          <div className="flex items-center justify-center h-full">
            <EmptyState icon={History} title="Select a tenant" message="Choose a tenant from the list to view their full history." />
          </div>
        ) : (
          <div className="p-6 max-w-3xl space-y-6">
            {/* Tenant header */}
            <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm flex items-center gap-5">
              <div className="w-14 h-14 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-xl font-bold shrink-0">
                {initials(selected.name)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl font-bold text-slate-900" style={{ fontFamily: 'Space Grotesk' }}>{selected.name}</h2>
                  <Badge status={selected.status} />
                </div>
                <p className="text-slate-500 text-sm mt-0.5">Room {selected.room} · ₹{(selected.rentAmount ?? 0).toLocaleString('en-IN')}/mo</p>
                <p className="text-slate-400 text-xs mt-1">
                  Moved in: {selected.moveInDate ? new Date(selected.moveInDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}
                  {selected.moveOutDate && ` · Vacated: ${new Date(selected.moveOutDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}`}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xl font-bold text-emerald-600" style={{ fontFamily: 'Space Grotesk' }}>{formatCurrency(totalPaid)}</p>
                <p className="text-xs text-slate-400 mt-0.5">Total paid (all time)</p>
              </div>
            </div>

            {/* Summary stats */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'Months Recorded',  value: tenantPayments.length },
                { label: 'Fully Paid',        value: tenantPayments.filter(p => p.status === 'paid').length },
                { label: 'Complaints Filed',  value: tenantComplaints.length },
              ].map(s => (
                <div key={s.label} className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm text-center">
                  <p className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Space Grotesk' }}>{s.value}</p>
                  <p className="text-slate-500 text-xs mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Payment history table */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100">
                <h3 className="font-semibold text-slate-900" style={{ fontFamily: 'Space Grotesk' }}>Payment History</h3>
              </div>
              {tenantPayments.length === 0 ? (
                <p className="text-center text-slate-400 text-sm py-8">No payments recorded yet</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100">
                        {['Month', 'Rent', 'Utility', 'Total', 'Paid', 'Balance', 'Status'].map((h, i) => (
                          <th key={h} className={`px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider ${i === 0 ? 'text-left' : 'text-right'}`}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {tenantPayments.map(p => {
                        const total = getTotalDue(p)
                        const bal = getBalance(p)
                        return (
                          <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-4 py-3 font-medium text-slate-900">{formatMonth(p.month)}</td>
                            <td className="px-4 py-3 text-right text-slate-600">{formatCurrency(p.rentAmount)}</td>
                            <td className="px-4 py-3 text-right text-slate-600">{formatCurrency(p.utilityShare ?? 0)}</td>
                            <td className="px-4 py-3 text-right font-semibold text-slate-900">{formatCurrency(total)}</td>
                            <td className="px-4 py-3 text-right text-emerald-600 font-medium">{formatCurrency(p.amountPaid ?? 0)}</td>
                            <td className="px-4 py-3 text-right text-amber-600">{formatCurrency(bal)}</td>
                            <td className="px-4 py-3 text-right"><Badge status={p.status} /></td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Complaint history */}
            {tenantComplaints.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100">
                  <h3 className="font-semibold text-slate-900" style={{ fontFamily: 'Space Grotesk' }}>Complaint History</h3>
                </div>
                <div className="divide-y divide-slate-50">
                  {tenantComplaints.map(c => (
                    <div key={c.id} className="px-5 py-4 flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm text-slate-900">{c.description}</p>
                        <p className="text-xs text-slate-400 mt-1 capitalize">{c.category} · {new Date(c.createdAt).toLocaleDateString('en-IN')}</p>
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
