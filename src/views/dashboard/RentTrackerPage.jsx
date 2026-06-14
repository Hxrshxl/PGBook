'use client'
import { useState, useMemo } from 'react'
import { IndianRupee, RefreshCw } from 'lucide-react'
import { useAppData } from '@/context/AppContext'
import { useToast } from '@/context/ToastContext'
import {
  getCurrentMonth, formatCurrency, formatMonth,
  getActiveTenants, getMonthPayments, getTotalDue, getBalance, calcPaymentStatus,
} from '@/utils/helpers'
import MonthSelector from '@/components/ui/MonthSelector'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import EmptyState from '@/components/ui/EmptyState'
import RecordPaymentModal from '@/components/rent/RecordPaymentModal'

export default function RentTrackerPage() {
  const { tenants, payments, addPayment, updatePayment } = useAppData()
  const { showToast } = useToast()
  const [month, setMonth] = useState(getCurrentMonth)
  const [recording, setRecording] = useState(null)

  const activeTenants = getActiveTenants(tenants)
  const monthPayments = getMonthPayments(payments, month)
  const rows = useMemo(() => activeTenants.map(t => ({
    tenant: t,
    payment: monthPayments.find(p => p.tenantId === t.id) ?? null,
  })), [activeTenants, monthPayments])

  const noPaymentRows = rows.filter(r => !r.payment)
  const summary = {
    collected:   monthPayments.reduce((s, p) => s + (p.amountPaid ?? 0), 0),
    outstanding: monthPayments.reduce((s, p) => s + getBalance(p), 0) + noPaymentRows.reduce((s, { tenant }) => s + tenant.rentAmount, 0),
    paid:        monthPayments.filter(p => p.status === 'paid').length,
    pending:     monthPayments.filter(p => p.status === 'pending').length + noPaymentRows.length,
  }

  async function autoGenerate() {
    try {
      await Promise.all(noPaymentRows.map(({ tenant }) =>
        addPayment({
          tenantId: tenant.id, month,
          rentAmount: tenant.rentAmount, utilityShare: 0,
          amountPaid: 0, status: 'pending', paidDate: null, notes: '',
        })
      ))
      showToast(`Dues generated for ${noPaymentRows.length} tenant(s).`)
    } catch (err) {
      showToast(err.message ?? 'Failed to generate dues.', 'error')
    }
  }

  async function markPaid(payment, tenant) {
    try {
      const total = getTotalDue(payment)
      await updatePayment(payment.id, { amountPaid: total, status: 'paid', paidDate: new Date().toISOString().split('T')[0] })
      showToast(`${tenant.name}'s rent marked as paid.`)
    } catch (err) {
      showToast(err.message ?? 'Failed to update payment.', 'error')
    }
  }

  async function handleRecord({ amount, notes }) {
    const { payment, tenantName } = recording
    const newPaid = (payment.amountPaid ?? 0) + amount
    const newStatus = calcPaymentStatus(newPaid, getTotalDue(payment))
    try {
      await updatePayment(payment.id, { amountPaid: newPaid, status: newStatus, paidDate: new Date().toISOString().split('T')[0], notes: notes || payment.notes })
      setRecording(null)
      showToast(`Payment recorded for ${tenantName}.`)
    } catch (err) {
      showToast(err.message ?? 'Failed to record payment.', 'error')
    }
  }

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Rent Tracker</h1>
          <p className="text-slate-500 text-sm mt-1">Track rent collection for {formatMonth(month)}</p>
        </div>
        <MonthSelector value={month} onChange={setMonth} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Collected',   value: formatCurrency(summary.collected),   cls: 'text-emerald-600' },
          { label: 'Outstanding', value: formatCurrency(summary.outstanding),  cls: 'text-amber-600'   },
          { label: 'Paid',        value: `${summary.paid} tenants`,            cls: 'text-slate-900'   },
          { label: 'Pending',     value: `${summary.pending} tenants`,         cls: 'text-red-600'     },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
            <p className={`text-xl font-bold mb-0.5 ${s.cls}`}>{s.value}</p>
            <p className="text-slate-500 text-xs">{s.label}</p>
          </div>
        ))}
      </div>

      {noPaymentRows.length > 0 && (
        <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-5 py-3 mb-5">
          <p className="text-amber-800 text-sm font-medium">{noPaymentRows.length} tenant(s) have no dues for {formatMonth(month)}.</p>
          <button onClick={autoGenerate} className="flex items-center gap-1.5 text-sm font-semibold text-amber-700 bg-white border border-amber-300 hover:border-amber-400 px-3 py-1.5 rounded-lg transition-colors">
            <RefreshCw size={13} /> Auto-generate
          </button>
        </div>
      )}

      {activeTenants.length === 0 ? (
        <EmptyState icon={IndianRupee} title="No active tenants" message="Add tenants first to track rent." />
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  {['Tenant', 'Rent', 'Utility', 'Total Due', 'Paid', 'Balance', 'Status', 'Actions'].map((h, i) => (
                    <th key={h} className={`text-slate-500 font-medium text-xs uppercase tracking-wider px-4 py-3.5 ${i === 0 ? 'text-left pl-5' : i === 7 ? 'text-right pr-5' : 'text-right'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {rows.map(({ tenant, payment }) => {
                  const rent = payment?.rentAmount ?? tenant.rentAmount
                  const utility = payment?.utilityShare ?? 0
                  const total = rent + utility
                  const paid = payment?.amountPaid ?? 0
                  const balance = Math.max(0, total - paid)
                  const status = payment?.status ?? 'pending'
                  return (
                    <tr key={tenant.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="pl-5 pr-4 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-xs font-bold shrink-0">{tenant.name[0]}</div>
                          <div><p className="font-medium text-slate-900">{tenant.name}</p><p className="text-slate-400 text-xs">Room {tenant.room}</p></div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-right text-slate-600">{formatCurrency(rent)}</td>
                      <td className="px-4 py-3.5 text-right text-slate-600">{formatCurrency(utility)}</td>
                      <td className="px-4 py-3.5 text-right font-semibold text-slate-900">{formatCurrency(total)}</td>
                      <td className="px-4 py-3.5 text-right text-emerald-600 font-medium">{formatCurrency(paid)}</td>
                      <td className="px-4 py-3.5 text-right text-amber-600 font-medium">{formatCurrency(balance)}</td>
                      <td className="px-4 py-3.5 text-center"><Badge status={status} /></td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-2">
                          {payment && status !== 'paid' && (
                            <>
                              <button onClick={() => markPaid(payment, tenant)} className="text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-lg transition-colors">Mark Paid</button>
                              <button onClick={() => setRecording({ payment, tenantName: tenant.name })} className="text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2.5 py-1 rounded-lg transition-colors">Record</button>
                            </>
                          )}
                          {!payment && <span className="text-xs text-slate-400 italic">No dues yet</span>}
                          {payment && status === 'paid' && <span className="text-xs text-emerald-600 font-medium">✓ Paid</span>}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal isOpen={!!recording} onClose={() => setRecording(null)} title={`Record Payment — ${recording?.tenantName}`} maxWidth="max-w-md">
        {recording && <RecordPaymentModal payment={recording.payment} tenantName={recording.tenantName} onSubmit={handleRecord} onClose={() => setRecording(null)} />}
      </Modal>
    </div>
  )
}
