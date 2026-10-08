'use client'
import { useState, useMemo } from 'react'
import { IndianRupee, RefreshCw } from 'lucide-react'
import { useAppData } from '@/context/AppContext'
import { useToast } from '@/context/ToastContext'
import { useAsyncAction } from '@/hooks/useAsyncAction'
import {
  getCurrentMonth, formatCurrency, formatCurrencyRounded, formatMonth, getMonthPayments, getTotalDue, getBalance, isBillableMonth,
} from '@/utils/helpers'
import MonthSelector from '@/components/ui/MonthSelector'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import EmptyState from '@/components/ui/EmptyState'
import RecordPaymentModal from '@/components/rent/RecordPaymentModal'
import PaymentDetailsModal from '@/components/rent/PaymentDetailsModal'

export default function RentTrackerPage() {
  const {
    tenants, payments, createDue, generateDues, updateDue, deleteDue, recordPayment, deletePaymentEntry,
  } = useAppData()
  const { showToast } = useToast()
  const [month, setMonth] = useState(getCurrentMonth)
  const [recordingId, setRecordingId] = useState(null)
  const [detailsId, setDetailsId] = useState(null)

  const monthPayments = useMemo(() => getMonthPayments(payments, month), [payments, month])

  // Active tenants living here that month, plus anyone (e.g. vacated) who has dues for it.
  const rows = useMemo(() => {
    const paymentByTenant = new Map(monthPayments.map(p => [p.tenantId, p]))
    return tenants
      .filter(t => paymentByTenant.has(t.id) || (t.status === 'active' && isBillableMonth(t.moveInDate, month)))
      .map(t => ({ tenant: t, payment: paymentByTenant.get(t.id) ?? null }))
      .sort((a, b) => a.tenant.room.localeCompare(b.tenant.room, undefined, { numeric: true }))
  }, [tenants, monthPayments, month])

  const noPaymentRows = rows.filter(r => !r.payment)
  const withDues = rows.filter(r => r.payment)
  const summary = {
    collected:   withDues.reduce((s, r) => s + (r.payment.amountPaid ?? 0), 0),
    outstanding: withDues.reduce((s, r) => s + getBalance(r.payment), 0) + noPaymentRows.reduce((s, r) => s + r.tenant.rentAmount, 0),
    paid:        withDues.filter(r => r.payment.status === 'paid').length,
    pending:     withDues.filter(r => r.payment.status !== 'paid').length + noPaymentRows.length,
  }

  const generate = useAsyncAction(async () => {
    const created = await generateDues(month)
    showToast(`Dues created for ${created.length} tenant(s).`)
  })
  const createOne = useAsyncAction(async (tenant) => {
    await createDue(tenant.id, month)
    showToast(`Dues created for ${tenant.name}.`)
  })

  const recording = rows.find(r => r.payment?.id === recordingId) ?? null
  const viewing = rows.find(r => r.payment?.id === detailsId) ?? null

  async function handleRecord(entry) {
    await recordPayment(recording.payment.id, entry)
    showToast(`${formatCurrency(entry.amount)} recorded for ${recording.tenant.name}.`)
    setRecordingId(null)
  }

  async function handleDeleteEntry(txId) {
    await deletePaymentEntry(viewing.payment.id, txId)
    showToast('Payment entry removed.', 'warning')
  }

  async function handleUpdateDue(data) {
    await updateDue(viewing.payment.id, data)
    showToast('Dues updated.')
  }

  async function handleDeleteDue() {
    await deleteDue(viewing.payment.id)
    setDetailsId(null)
    showToast('Dues deleted.', 'warning')
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Rent Tracker</h1>
          <p className="text-slate-500 text-sm mt-1">Track rent collection for {formatMonth(month)}</p>
        </div>
        <MonthSelector value={month} onChange={setMonth} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Collected',   value: formatCurrencyRounded(summary.collected),   cls: 'text-emerald-600' },
          { label: 'Outstanding', value: formatCurrencyRounded(summary.outstanding), cls: 'text-amber-600'   },
          { label: 'Paid',        value: `${summary.paid} tenant${summary.paid === 1 ? '' : 's'}`,       cls: 'text-slate-900' },
          { label: 'Pending',     value: `${summary.pending} tenant${summary.pending === 1 ? '' : 's'}`, cls: 'text-red-600'   },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
            <p className={`text-xl font-bold mb-0.5 ${s.cls}`}>{s.value}</p>
            <p className="text-slate-500 text-xs">{s.label}</p>
          </div>
        ))}
      </div>

      {noPaymentRows.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-amber-50 border border-amber-200 rounded-xl px-5 py-3 mb-5">
          <p className="text-amber-800 text-sm font-medium">{noPaymentRows.length} tenant(s) have no dues for {formatMonth(month)} yet.</p>
          <button onClick={() => generate.run()} disabled={generate.busy} className="flex items-center justify-center gap-1.5 text-sm font-semibold text-amber-700 bg-white border border-amber-300 hover:border-amber-400 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60">
            <RefreshCw size={13} className={generate.busy ? 'animate-spin' : ''} /> {generate.busy ? 'Creating…' : 'Create dues for all'}
          </button>
        </div>
      )}
      {(generate.error || createOne.error) && (
        <p className="text-red-600 text-sm mb-4">{generate.error || createOne.error}</p>
      )}

      {rows.length === 0 ? (
        <EmptyState icon={IndianRupee} title="No tenants for this month" message="Add tenants first to track rent." />
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[760px]">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  {['Tenant', 'Rent', 'Utility', 'Total Due', 'Paid', 'Balance', 'Status', 'Actions'].map((h, i) => (
                    <th key={h} scope="col" className={`text-slate-500 font-medium text-xs uppercase tracking-wider px-4 py-3.5 ${i === 0 ? 'text-left pl-5' : i === 6 ? 'text-center' : i === 7 ? 'text-right pr-5' : 'text-right'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {rows.map(({ tenant, payment }) => {
                  const rent = payment?.rentAmount ?? tenant.rentAmount
                  const utility = payment?.utilityShare ?? 0
                  const total = payment ? getTotalDue(payment) : rent
                  const paid = payment?.amountPaid ?? 0
                  const balance = payment ? getBalance(payment) : rent
                  const status = payment?.status ?? 'pending'
                  return (
                    <tr key={tenant.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="pl-5 pr-4 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-xs font-bold shrink-0">{tenant.name[0]}</div>
                          <div>
                            <p className="font-medium text-slate-900">{tenant.name}</p>
                            <p className="text-slate-400 text-xs">Room {tenant.room}{tenant.status === 'vacated' && ' · Vacated'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-right text-slate-600">{formatCurrency(rent)}</td>
                      <td className="px-4 py-3.5 text-right text-slate-600">{formatCurrency(utility)}</td>
                      <td className="px-4 py-3.5 text-right font-semibold text-slate-900">{formatCurrency(total)}</td>
                      <td className="px-4 py-3.5 text-right text-emerald-600 font-medium">{formatCurrency(paid)}</td>
                      <td className="px-4 py-3.5 text-right text-amber-600 font-medium">{formatCurrency(balance)}</td>
                      <td className="px-4 py-3.5 text-center">{payment ? <Badge status={status} /> : <span className="text-xs text-slate-400 italic">No dues</span>}</td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-2">
                          {payment ? (
                            <>
                              {status !== 'paid' && (
                                <button onClick={() => setRecordingId(payment.id)} className="text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-lg transition-colors">
                                  Record payment
                                </button>
                              )}
                              <button onClick={() => setDetailsId(payment.id)} className="text-xs font-medium text-slate-600 bg-white hover:bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-lg transition-colors">
                                Details
                              </button>
                            </>
                          ) : (
                            <button onClick={() => createOne.run(tenant)} disabled={createOne.busy} className="text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2.5 py-1 rounded-lg transition-colors disabled:opacity-60">
                              Create dues
                            </button>
                          )}
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

      <Modal isOpen={!!recording} onClose={() => setRecordingId(null)} title={`Record Payment — ${recording?.tenant.name ?? ''}`} maxWidth="max-w-md">
        {recording && <RecordPaymentModal payment={recording.payment} tenantName={recording.tenant.name} onSubmit={handleRecord} onClose={() => setRecordingId(null)} />}
      </Modal>
      <Modal isOpen={!!viewing} onClose={() => setDetailsId(null)} title={`${viewing?.tenant.name ?? ''} — ${formatMonth(month)}`} maxWidth="max-w-md">
        {viewing && (
          <PaymentDetailsModal
            key={viewing.payment.id}
            payment={viewing.payment}
            tenantName={viewing.tenant.name}
            onDeleteEntry={handleDeleteEntry}
            onUpdateDue={handleUpdateDue}
            onDeleteDue={handleDeleteDue}
            onClose={() => setDetailsId(null)}
          />
        )}
      </Modal>
    </div>
  )
}
