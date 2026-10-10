'use client'
import { useState } from 'react'
import { Trash2, Clock } from 'lucide-react'
import {
  formatCurrency, formatDate, formatMonth, getTotalDue, getBalance, getPaymentEntries, roundMoney, PAYMENT_METHOD_LABELS,
} from '@/utils/helpers'
import { LIMITS } from '@/lib/policy'
import { useAuth } from '@/context/AuthContext'
import { useAsyncAction } from '@/hooks/useAsyncAction'
import Badge from '@/components/ui/Badge'
import FormError from '@/components/ui/FormError'

const inputCls = 'w-full border border-slate-200 rounded-md px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-indigo-500 bg-white'

/**
 * Everything about one month's dues: what makes up the total, every amount
 * received, and corrections. Staff corrections above their limit go to the
 * owner for approval (onUpdateDue / onDeleteEntry resolve to { pending }).
 */
export default function PaymentDetailsModal({ payment, tenantName, pendingCash = [], onDeleteEntry, onUpdateDue, onDeleteDue, onClose }) {
  const { can } = useAuth()
  const [rent, setRent] = useState(String(payment.rentAmount ?? 0))
  const [lateFee, setLateFee] = useState(String(payment.lateFee ?? 0))
  const [notes, setNotes] = useState(payment.notes ?? '')
  const [reason, setReason] = useState('')
  const [confirmingEntry, setConfirmingEntry] = useState(null)
  const [entryReason, setEntryReason] = useState('')
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [notice, setNotice] = useState('')
  const entries = getPaymentEntries(payment)
  const charges = payment.extraCharges ?? []
  const pendingCashTotal = pendingCash.reduce((s, c) => s + c.amount, 0)

  const canEdit = can('rent.manage')
  const removeDirect = can('rent.removeEntry')
  const removeByRequest = !removeDirect && can('rent.requestRemoveEntry')

  // Does this change need the owner's approval? (Mirrors the server's rule.)
  const size = Math.abs(roundMoney((Number(rent) || 0) - payment.rentAmount + (Number(lateFee) || 0) - (payment.lateFee ?? 0)))
  const needsApproval = size > 0 && !can('rent.adjustAny') && !(can('rent.adjust') && size <= LIMITS.managerAdjustLimit)
  const dirty = Number(rent) !== payment.rentAmount || Number(lateFee) !== (payment.lateFee ?? 0) || notes !== (payment.notes ?? '')

  const save = useAsyncAction(async () => {
    const result = await onUpdateDue({ rentAmount: Number(rent), lateFee: Number(lateFee), notes, ...(needsApproval ? { reason: reason.trim() } : {}) })
    if (result?.pending) {
      setNotice('Sent to the owner for approval. The dues change once they approve.')
      setRent(String(payment.rentAmount ?? 0))
      setLateFee(String(payment.lateFee ?? 0))
      setReason('')
    }
  })
  const removeEntry = useAsyncAction(async txId => {
    const result = await onDeleteEntry(txId, removeByRequest ? entryReason.trim() : undefined)
    setConfirmingEntry(null)
    setEntryReason('')
    if (result?.pending) setNotice('Removal sent to the owner for approval.')
  })
  const removeDue = useAsyncAction(onDeleteDue)
  const error = save.error || removeEntry.error || removeDue.error

  const row = (label, value, cls = 'text-slate-900') => (
    <div className="flex justify-between gap-3"><span className="text-slate-500">{label}</span><span className={cls}>{value}</span></div>
  )

  return (
    <div className="space-y-5">
      <div className="bg-slate-50 rounded-xl p-4 space-y-2 text-sm">
        {row('Tenant', tenantName, 'font-medium text-slate-900')}
        {row('Month', formatMonth(payment.month))}
        {row('Rent', formatCurrency(payment.rentAmount))}
        {charges.map((c, i) => <div key={i}>{row(c.label, formatCurrency(c.amount))}</div>)}
        {payment.utilityShare > 0 && row('Utility share', formatCurrency(payment.utilityShare))}
        {payment.lateFee > 0 && row('Late fee', formatCurrency(payment.lateFee), 'text-red-600')}
        <div className="flex justify-between border-t border-slate-200 pt-2"><span className="text-slate-700 font-medium">Total due</span><span className="font-semibold text-slate-900">{formatCurrency(getTotalDue(payment))}</span></div>
        {row('Received', formatCurrency(payment.amountPaid ?? 0), 'text-emerald-600 font-medium')}
        <div className="flex justify-between"><span className="text-slate-700 font-medium">Balance</span><span className="font-semibold text-amber-700">{formatCurrency(getBalance(payment))}</span></div>
        {pendingCashTotal > 0 && (
          <div className="flex justify-between text-amber-700"><span className="flex items-center gap-1"><Clock size={12} /> Cash awaiting confirmation</span><span>{formatCurrency(pendingCashTotal)}</span></div>
        )}
        <div className="flex justify-between items-center"><span className="text-slate-500">Status</span><Badge status={payment.status} /></div>
      </div>

      {notice && <p role="status" className="text-sm text-indigo-800 bg-indigo-50 border border-indigo-100 rounded-xl px-3.5 py-2.5">{notice}</p>}

      <div>
        <h3 className="text-sm font-semibold text-slate-900 mb-2">Payments received</h3>
        {entries.length === 0 ? (
          <p className="text-sm text-slate-400">Nothing received yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100 border border-slate-100 rounded-xl">
            {entries.map(entry => (
              <li key={entry.id} className="px-3.5 py-2.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900">{formatCurrency(entry.amount)} <span className="text-slate-400 font-normal">· {PAYMENT_METHOD_LABELS[entry.method] ?? entry.method}</span></p>
                    <p className="text-xs text-slate-400 truncate">
                      {formatDate(entry.date)}{entry.note ? ` · ${entry.note}` : ''}{entry.recordedBy?.name ? ` · ${entry.source === 'claim' ? 'confirmed' : 'by'} ${entry.recordedBy.name}` : ''}{entry.source === 'claim' ? ' · tenant app' : entry.source === 'deposit' ? ' · from deposit' : ''}
                    </p>
                  </div>
                  {!entry.legacy && (removeDirect || removeByRequest) && confirmingEntry !== entry.id && (
                    <button onClick={() => { setConfirmingEntry(entry.id); setEntryReason('') }} aria-label="Remove this payment entry" className="text-slate-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 shrink-0">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
                {confirmingEntry === entry.id && (
                  <div className="mt-2 space-y-2">
                    {removeByRequest && (
                      <input aria-label="Reason for removing" autoFocus maxLength={500} value={entryReason} onChange={e => setEntryReason(e.target.value)}
                        placeholder="Why should this be removed? (the owner will see this)" className={inputCls} />
                    )}
                    <div className="flex items-center justify-end gap-1.5">
                      <button onClick={() => setConfirmingEntry(null)} className="text-xs text-slate-500 px-2 py-1">Keep</button>
                      <button
                        disabled={removeEntry.busy || (removeByRequest && entryReason.trim().length < 3)}
                        onClick={() => removeEntry.run(entry.id)}
                        className="text-xs font-semibold text-white bg-red-600 hover:bg-red-500 px-2.5 py-1 rounded-lg disabled:opacity-60"
                      >
                        {removeEntry.busy ? 'Working…' : removeByRequest ? 'Ask owner to remove' : 'Remove'}
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {canEdit ? (
        <form onSubmit={e => { e.preventDefault(); save.run() }} className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-900">Adjust this month</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="due-rent" className="block text-slate-600 text-xs font-medium mb-1">Rent for {formatMonth(payment.month)}</label>
              <input id="due-rent" type="number" min="0" step="1" value={rent} onChange={e => setRent(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label htmlFor="due-late" className="block text-slate-600 text-xs font-medium mb-1">Late fee <span className="text-slate-400">(0 = waive)</span></label>
              <input id="due-late" type="number" min="0" step="1" value={lateFee} onChange={e => setLateFee(e.target.value)} className={inputCls} />
            </div>
          </div>
          <p className="text-xs text-slate-400 -mt-1">For a discount, a pro-rated first month, or waiving a late fee.</p>
          <div>
            <label htmlFor="due-notes" className="block text-slate-600 text-xs font-medium mb-1">Notes</label>
            <input id="due-notes" type="text" maxLength={500} value={notes} onChange={e => setNotes(e.target.value)} className={inputCls} />
          </div>
          {needsApproval && (
            <div>
              <label htmlFor="due-reason" className="block text-slate-600 text-xs font-medium mb-1">Reason for the owner *</label>
              <input id="due-reason" required minLength={3} maxLength={1000} value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Agreed ₹500 discount for AC repair delay" className={inputCls} />
              <p className="text-xs text-amber-700 mt-1">This change needs the owner&apos;s approval.</p>
            </div>
          )}
          <FormError message={error} />
          <div className="flex items-center justify-between gap-3 pt-1">
            {entries.length === 0 && pendingCash.length === 0 ? (
              confirmingDelete ? (
                <button type="button" onClick={() => removeDue.run()} disabled={removeDue.busy} className="text-xs font-semibold text-white bg-red-600 hover:bg-red-500 px-3 py-2 rounded-lg disabled:opacity-60">
                  {removeDue.busy ? 'Deleting…' : 'Confirm delete'}
                </button>
              ) : (
                <button type="button" onClick={() => setConfirmingDelete(true)} className="text-xs font-medium text-red-600 hover:text-red-700">
                  Delete this due
                </button>
              )
            ) : <span />}
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap h-9 px-3.5 text-sm rounded-md border border-slate-200 bg-white font-medium text-slate-700 shadow-xs transition-colors hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50">Close</button>
              <button type="submit" disabled={!dirty || save.busy || (needsApproval && reason.trim().length < 3)} className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap h-9 px-3.5 text-sm rounded-md bg-indigo-600 font-medium text-white shadow-xs transition-colors hover:bg-indigo-700 disabled:opacity-50">
                {save.busy ? 'Saving…' : needsApproval ? 'Send for approval' : 'Save'}
              </button>
            </div>
          </div>
        </form>
      ) : (
        <>
          <FormError message={error} />
          {payment.notes && <p className="text-sm text-slate-600"><span className="text-slate-400">Notes:</span> {payment.notes}</p>}
          <div className="flex justify-end">
            <button type="button" onClick={onClose} className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap h-9 px-3.5 text-sm rounded-md border border-slate-200 bg-white font-medium text-slate-700 shadow-xs transition-colors hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50">Close</button>
          </div>
        </>
      )}
    </div>
  )
}
