'use client'
import { useState, useMemo } from 'react'
import { IndianRupee, RefreshCw, Timer } from 'lucide-react'
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
import PageHeader from '@/components/ui/PageHeader'
import StatStrip from '@/components/ui/StatStrip'
import RowMenu from '@/components/ui/RowMenu'
import { btn, button, page } from '@/components/ui/styles'
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

  function figures({ tenant, payment }) {
    const rent = payment?.rentAmount ?? tenant.rentAmount
    const charges = payment ? payment.extraCharges ?? [] : tenant.recurringCharges ?? []
    const utility = payment?.utilityShare ?? 0
    const extras = chargesTotal(charges) + utility
    const extrasTitle = [...charges.map(c => `${c.label} ${formatCurrency(c.amount)}`), utility ? `Utilities ${formatCurrency(utility)}` : null].filter(Boolean).join(' + ')
    const total = payment ? getTotalDue(payment) : rent + extras
    const balance = payment ? getBalance(payment) : total
    const waiting = payment ? pendingCashBy.get(payment.id) ?? [] : []
    return {
      rent, extras, extrasTitle, total, balance,
      late: payment?.lateFee ?? 0,
      paid: payment?.amountPaid ?? 0,
      status: payment?.status ?? 'pending',
      waitingTotal: waiting.reduce((a, c) => a + c.amount, 0),
    }
  }

  function actions({ tenant, payment }, f) {
    if (!payment) {
      return canCreateDues && (
        <button onClick={() => createOne.run(tenant)} disabled={createOne.busy} className={button('secondary', 'xs')}>Create dues</button>
      )
    }
    return (
      <>
        {f.status !== 'paid' && canRecord && (
          <button onClick={() => setRecordingId(payment.id)} className={button('secondary', 'xs')}>Record payment</button>
        )}
        {f.status !== 'paid' && canCollect && f.balance - f.waitingTotal > 0 && (
          <button onClick={() => setCollectingId(payment.id)} className={button('secondary', 'xs')}>Collect cash</button>
        )}
        <button onClick={() => setDetailsId(payment.id)} className={button('ghost', 'xs')}>Details</button>
      </>
    )
  }

  // The same actions as a compact menu, for table widths where the buttons don't fit.
  const menuFor = ({ tenant, payment }, f) => payment ? [
    { label: 'Record payment', onClick: () => setRecordingId(payment.id), hidden: f.status === 'paid' || !canRecord },
    { label: 'Collect cash', onClick: () => setCollectingId(payment.id), hidden: f.status === 'paid' || !canCollect || f.balance - f.waitingTotal <= 0 },
    { label: 'Details', onClick: () => setDetailsId(payment.id) },
  ] : [
    { label: 'Create dues', onClick: () => createOne.run(tenant), hidden: !canCreateDues },
  ]

  const place = tenant => `${tenant.room}${showProperty ? ` · ${propertyById.get(tenant.propertyId)?.name ?? ''}` : ''}${tenant.status === 'vacated' ? ' · moved out' : ''}`
  const dash = <span className="text-slate-300">—</span>

  return (
    <div className={`${page} mx-auto max-w-6xl`}>
      <PageHeader
        title="Rent"
        description={`Who has paid for ${formatMonth(month)}, and who still owes.`}
        actions={<>
          {can('rent.lateFees') && lateFeesOn && (
            <button onClick={() => lateFees.run()} disabled={lateFees.busy} title="Add late fees to overdue dues under each property's late fee rule" className={btn.secondary}>
              <Timer size={14} /> {lateFees.busy ? 'Applying…' : 'Apply late fees'}
            </button>
          )}
          <MonthSelector value={month} onChange={setMonth} />
        </>}
      />

      <StatStrip className="mb-4" items={[
        { label: 'Collected', value: formatCurrencyRounded(summary.collected), sub: summary.lateFees > 0 ? `incl. ${formatCurrency(summary.lateFees)} late fees` : undefined },
        { label: 'Outstanding', value: formatCurrencyRounded(summary.outstanding), tone: summary.outstanding > 0 ? 'warning' : 'default', sub: summary.pendingCash > 0 ? `${formatCurrencyRounded(summary.pendingCash)} cash awaiting confirmation` : undefined },
        { label: 'Paid in full', value: summary.paid, sub: `tenant${summary.paid === 1 ? '' : 's'}` },
        { label: 'Not fully paid', value: summary.pending, sub: `tenant${summary.pending === 1 ? '' : 's'}`, tone: summary.pending > 0 ? 'negative' : 'default' },
      ]} />

      {noPaymentRows.length > 0 && canCreateDues && (
        <div className="mb-4 flex flex-col justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center">
          <p className="flex items-center gap-2 text-sm text-slate-700"><span className="h-1.5 w-1.5 rounded-full bg-amber-500" />{noPaymentRows.length} tenant{noPaymentRows.length === 1 ? ' has' : 's have'} no dues for {formatMonth(month)} yet.</p>
          <button onClick={() => generate.run()} disabled={generate.busy} className={button('secondary', 'sm')}>
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
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full xl:min-w-[860px] text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  {['Tenant', 'Rent', 'Extras', 'Late fee', 'Total', 'Paid', 'Balance', 'Status', ''].map((h, i) => (
                    <th key={h || 'actions'} scope="col" className={`whitespace-nowrap px-3 py-2.5 text-xs font-medium text-slate-500 ${i >= 1 && i <= 3 ? 'hidden xl:table-cell ' : ''}${i === 0 ? 'pl-4 text-left' : i === 7 ? 'text-left' : i === 8 ? 'pr-4' : 'text-right'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map(row => {
                  const { tenant, payment } = row
                  const f = figures(row)
                  return (
                    <tr key={tenant.id} className="hover:bg-slate-50/70">
                      <td className="py-2.5 pl-4 pr-3">
                        <p className="whitespace-nowrap font-medium text-slate-900">{tenant.name}</p>
                        <p className="max-w-[200px] truncate text-xs text-slate-500 xl:max-w-none xl:whitespace-nowrap" title={place(tenant)}>{place(tenant)}</p>
                      </td>
                      <td className="hidden px-3 py-2.5 text-right xl:table-cell tabular-nums text-slate-600">{formatCurrency(f.rent)}</td>
                      <td className="hidden px-3 py-2.5 text-right xl:table-cell tabular-nums text-slate-600" title={f.extrasTitle || undefined}>{f.extras ? formatCurrency(f.extras) : dash}</td>
                      <td className="hidden px-3 py-2.5 text-right xl:table-cell tabular-nums">{f.late ? <span className="text-red-600">{formatCurrency(f.late)}</span> : dash}</td>
                      <td className="px-3 py-2.5 text-right font-medium tabular-nums text-slate-900">{formatCurrency(f.total)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">{formatCurrency(f.paid)}</td>
                      <td className="px-3 py-2.5 text-right font-medium tabular-nums text-slate-900">{f.balance > 0 ? formatCurrency(f.balance) : dash}</td>
                      <td className="px-3 py-2.5">
                        {payment ? <Badge status={f.status} /> : <span className="whitespace-nowrap text-xs text-slate-400">No dues yet</span>}
                        {f.waitingTotal > 0 && <p className="mt-1 text-[11px] leading-tight text-amber-700">{formatCurrency(f.waitingTotal)} cash pending</p>}
                      </td>
                      <td className="py-2.5 pl-3 pr-4">
                        <div className="hidden items-center justify-end gap-1.5 xl:flex">{actions(row, f)}</div>
                        <div className="text-right xl:hidden"><RowMenu items={menuFor(row, f)} label={`Actions for ${tenant.name}`} /></div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <ul className="divide-y divide-slate-100 md:hidden">
            {rows.map(row => {
              const { tenant, payment } = row
              const f = figures(row)
              return (
                <li key={tenant.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900">{tenant.name}</p>
                      <p className="truncate text-xs text-slate-500">{place(tenant)}</p>
                    </div>
                    {payment ? <Badge status={f.status} /> : <span className="text-xs text-slate-400">No dues yet</span>}
                  </div>
                  <dl className="mt-2 grid grid-cols-3 gap-2 text-xs">
                    <div><dt className="text-slate-500">Total</dt><dd className="font-medium tabular-nums text-slate-900">{formatCurrency(f.total)}</dd></div>
                    <div><dt className="text-slate-500">Paid</dt><dd className="tabular-nums text-slate-700">{formatCurrency(f.paid)}</dd></div>
                    <div><dt className="text-slate-500">Balance</dt><dd className="font-medium tabular-nums text-slate-900">{f.balance > 0 ? formatCurrency(f.balance) : '—'}</dd></div>
                  </dl>
                  {f.waitingTotal > 0 && <p className="mt-1.5 text-[11px] text-amber-700">{formatCurrency(f.waitingTotal)} cash waiting for confirmation</p>}
                  <div className="mt-2.5 flex flex-wrap gap-1.5">{actions(row, f)}</div>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      <Modal isOpen={!!recording} onClose={() => setRecordingId(null)} title="Record payment" description={recording?.tenant.name} maxWidth="max-w-md">
        {recording && <RecordPaymentModal payment={recording.payment} tenantName={recording.tenant.name} pendingCash={pendingCashBy.get(recording.payment.id)} onSubmit={handleRecord} onClose={() => setRecordingId(null)} />}
      </Modal>
      <Modal isOpen={!!collecting} onClose={() => setCollectingId(null)} title="Collect cash" description={collecting?.tenant.name} maxWidth="max-w-md">
        {collecting && <RecordPaymentModal mode="cash" payment={collecting.payment} tenantName={collecting.tenant.name} pendingCash={pendingCashBy.get(collecting.payment.id)} onSubmit={handleCollect} onClose={() => setCollectingId(null)} />}
      </Modal>
      <Modal isOpen={!!viewing} onClose={() => setDetailsId(null)} title={viewing?.tenant.name ?? ''} description={formatMonth(month)} maxWidth="max-w-md">
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
