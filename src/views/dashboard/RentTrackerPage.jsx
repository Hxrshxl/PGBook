'use client'
import { useState, useMemo } from 'react'
import { IndianRupee, RefreshCw, Clock, Timer } from 'lucide-react'
import { useAppData } from '@/context/AppContext'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { useAsyncAction } from '@/hooks/useAsyncAction'
import {
  getCurrentMonth, formatCurrency, formatCurrencyRounded, formatMonth, getMonthPayments, getTotalDue, getBalance, isBillableMonth,
  chargesTotal, roundMoney,
} from '@/utils/helpers'
import MonthSelector from '@/components/ui/MonthSelector'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import EmptyState from '@/components/ui/EmptyState'
import RecordPaymentModal from '@/components/rent/RecordPaymentModal'
import PaymentDetailsModal from '@/components/rent/PaymentDetailsModal'

export default function RentTrackerPage() {
  const {
    tenants, payments, cash, properties, currentProperty, propertyById,
    createDue, generateDues, applyLateFees, updateDue, deleteDue, recordPayment, deletePaymentEntry, collectCash,
  } = useAppData()
  const { can } = useAuth()
  const { showToast } = useToast()
  const canRecord = can('rent.record')
  const canCollect = !canRecord && can('cash.collect')
  const canCreateDues = can('rent.manage')
  const showProperty = !currentProperty && properties.length > 1
  const lateFeesOn = (currentProperty ? [currentProperty] : properties).some(p => p.lateFee?.enabled && p.lateFee?.amount > 0)
  const [collectingId, setCollectingId] = useState(null)

  // Cash a caretaker logged that nobody has confirmed yet, per dues record.
  const pendingCashBy = useMemo(() => {
    const map = new Map()
    for (const c of cash) if (c.status === 'pending') map.set(c.paymentId, [...(map.get(c.paymentId) ?? []), c])
    return map
  }, [cash])
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
    outstanding: withDues.reduce((s, r) => s + getBalance(r.payment), 0) + noPaymentRows.reduce((s, r) => s + r.tenant.rentAmount + chargesTotal(r.tenant.recurringCharges), 0),
    lateFees:    withDues.reduce((s, r) => s + (r.payment.lateFee ?? 0), 0),
    pendingCash: roundMoney(withDues.reduce((s, r) => s + (pendingCashBy.get(r.payment.id) ?? []).reduce((a, c) => a + c.amount, 0), 0)),
    paid:        withDues.filter(r => r.payment.status === 'paid').length,
    pending:     withDues.filter(r => r.payment.status !== 'paid').length + noPaymentRows.length,
  }

  const generate = useAsyncAction(async () => {
    const created = await generateDues(month)
    showToast(`Dues created for ${created.length} tenant(s).`)
  })
  const lateFees = useAsyncAction(async () => {
    const updated = await applyLateFees(month)
    showToast(updated.length ? `Late fee added to ${updated.length} unpaid due(s).` : 'No late fees due right now — everyone is within the grace period or paid.', updated.length ? 'success' : 'info')
  })
  const createOne = useAsyncAction(async (tenant) => {
    await createDue(tenant.id, month)
    showToast(`Dues created for ${tenant.name}.`)
  })

  const recording = rows.find(r => r.payment?.id === recordingId) ?? null
  const viewing = rows.find(r => r.payment?.id === detailsId) ?? null
  const collecting = rows.find(r => r.payment?.id === collectingId) ?? null

  async function handleCollect(entry) {
    await collectCash(collecting.payment.id, entry)
    showToast(`${formatCurrency(entry.amount)} from ${collecting.tenant.name} logged. It counts once the handover is confirmed.`)
    setCollectingId(null)
  }

  async function handleRecord(entry) {
    await recordPayment(recording.payment.id, entry)
    showToast(`${formatCurrency(entry.amount)} recorded for ${recording.tenant.name}.`)
    setRecordingId(null)
  }

  async function handleDeleteEntry(txId, reason) {
    const result = await deletePaymentEntry(viewing.payment.id, txId, reason)
    showToast(result.pending ? 'Sent to the owner for approval.' : 'Payment entry removed.', result.pending ? 'info' : 'warning')
    return result
  }

  async function handleUpdateDue(data) {
    const result = await updateDue(viewing.payment.id, data)
    showToast(result.pending ? 'Sent to the owner for approval.' : 'Dues updated.', result.pending ? 'info' : 'success')
    return result
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
        <div className="flex items-center gap-3">
          {can('rent.lateFees') && lateFeesOn && (
            <button onClick={() => lateFees.run()} disabled={lateFees.busy} title="Add late fees to overdue dues under each property's late fee rule"
              className="flex items-center gap-1.5 text-sm font-medium text-slate-700 border border-slate-200 hover:border-slate-300 bg-white px-3 py-1.5 rounded-lg disabled:opacity-60">
              <Timer size={14} /> {lateFees.busy ? 'Applying…' : 'Apply late fees'}
            </button>
          )}
          <MonthSelector value={month} onChange={setMonth} />
        </div>
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
      <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-500 -mt-3 mb-6">
        {summary.lateFees > 0 && <span>Includes {formatCurrency(summary.lateFees)} in late fees</span>}
        {summary.pendingCash > 0 && <span className="text-amber-700 flex items-center gap-1"><Clock size={12} /> {formatCurrencyRounded(summary.pendingCash)} cash waiting for confirmation</span>}
      </div>

      {noPaymentRows.length > 0 && canCreateDues && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-amber-50 border border-amber-200 rounded-xl px-5 py-3 mb-5">
          <p className="text-amber-800 text-sm font-medium">{noPaymentRows.length} tenant(s) have no dues for {formatMonth(month)} yet.</p>
          <button onClick={() => generate.run()} disabled={generate.busy} className="flex items-center justify-center gap-1.5 text-sm font-semibold text-amber-700 bg-white border border-amber-300 hover:border-amber-400 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60">
            <RefreshCw size={13} className={generate.busy ? 'animate-spin' : ''} /> {generate.busy ? 'Creating…' : 'Create dues for all'}
          </button>
        </div>
      )}
      {(generate.error || createOne.error || lateFees.error) && (
        <p className="text-red-600 text-sm mb-4">{generate.error || createOne.error || lateFees.error}</p>
      )}

      {rows.length === 0 ? (
        <EmptyState icon={IndianRupee} title="No tenants for this month" message="Add tenants first to track rent." />
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[820px]">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  {['Tenant', 'Rent', 'Extras', 'Late fee', 'Total Due', 'Paid', 'Balance', 'Status', 'Actions'].map((h, i) => (
                    <th key={h} scope="col" className={`text-slate-500 font-medium text-xs uppercase tracking-wider px-4 py-3.5 ${i === 0 ? 'text-left pl-5' : i === 7 ? 'text-center' : i === 8 ? 'text-right pr-5' : 'text-right'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {rows.map(({ tenant, payment }) => {
                  const rent = payment?.rentAmount ?? tenant.rentAmount
                  const charges = payment ? payment.extraCharges ?? [] : tenant.recurringCharges ?? []
                  const utility = payment?.utilityShare ?? 0
                  const extras = chargesTotal(charges) + utility
                  const extrasTitle = [...charges.map(c => `${c.label} ${formatCurrency(c.amount)}`), utility ? `Utilities ${formatCurrency(utility)}` : null].filter(Boolean).join(' + ')
                  const late = payment?.lateFee ?? 0
                  const total = payment ? getTotalDue(payment) : rent + extras
                  const paid = payment?.amountPaid ?? 0
                  const balance = payment ? getBalance(payment) : total
                  const status = payment?.status ?? 'pending'
                  const waiting = payment ? pendingCashBy.get(payment.id) ?? [] : []
                  const waitingTotal = waiting.reduce((a, c) => a + c.amount, 0)
                  return (
                    <tr key={tenant.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="pl-5 pr-4 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-xs font-bold shrink-0">{tenant.name[0]}</div>
                          <div>
                            <p className="font-medium text-slate-900">{tenant.name}</p>
                            <p className="text-slate-400 text-xs">Room {tenant.room}{showProperty && ` · ${propertyById.get(tenant.propertyId)?.name ?? ''}`}{tenant.status === 'vacated' && ' · Vacated'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-right text-slate-600">{formatCurrency(rent)}</td>
                      <td className="px-4 py-3.5 text-right text-slate-600" title={extrasTitle || undefined}>{extras ? formatCurrency(extras) : '—'}</td>
                      <td className={`px-4 py-3.5 text-right ${late ? 'text-red-600' : 'text-slate-400'}`}>{late ? formatCurrency(late) : '—'}</td>
                      <td className="px-4 py-3.5 text-right font-semibold text-slate-900">{formatCurrency(total)}</td>
                      <td className="px-4 py-3.5 text-right text-emerald-600 font-medium">{formatCurrency(paid)}</td>
                      <td className="px-4 py-3.5 text-right text-amber-600 font-medium">{formatCurrency(balance)}</td>
                      <td className="px-4 py-3.5 text-center">
                        {payment ? <Badge status={status} /> : <span className="text-xs text-slate-400 italic">No dues</span>}
                        {waitingTotal > 0 && <p className="text-[11px] text-amber-700 mt-1 whitespace-nowrap">{formatCurrency(waitingTotal)} cash pending</p>}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-2">
                          {payment ? (
                            <>
                              {status !== 'paid' && canRecord && (
                                <button onClick={() => setRecordingId(payment.id)} className="text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-lg transition-colors">
                                  Record payment
                                </button>
                              )}
                              {status !== 'paid' && canCollect && balance - waitingTotal > 0 && (
                                <button onClick={() => setCollectingId(payment.id)} className="text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-lg transition-colors">
                                  Collect cash
                                </button>
                              )}
                              <button onClick={() => setDetailsId(payment.id)} className="text-xs font-medium text-slate-600 bg-white hover:bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-lg transition-colors">
                                Details
                              </button>
                            </>
                          ) : canCreateDues && (
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
        {recording && <RecordPaymentModal payment={recording.payment} tenantName={recording.tenant.name} pendingCash={pendingCashBy.get(recording.payment.id)} onSubmit={handleRecord} onClose={() => setRecordingId(null)} />}
      </Modal>
      <Modal isOpen={!!collecting} onClose={() => setCollectingId(null)} title={`Collect cash — ${collecting?.tenant.name ?? ''}`} maxWidth="max-w-md">
        {collecting && <RecordPaymentModal mode="cash" payment={collecting.payment} tenantName={collecting.tenant.name} pendingCash={pendingCashBy.get(collecting.payment.id)} onSubmit={handleCollect} onClose={() => setCollectingId(null)} />}
      </Modal>
      <Modal isOpen={!!viewing} onClose={() => setDetailsId(null)} title={`${viewing?.tenant.name ?? ''} — ${formatMonth(month)}`} maxWidth="max-w-md">
        {viewing && (
          <PaymentDetailsModal
            key={viewing.payment.id}
            payment={viewing.payment}
            tenantName={viewing.tenant.name}
            pendingCash={pendingCashBy.get(viewing.payment.id)}
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
