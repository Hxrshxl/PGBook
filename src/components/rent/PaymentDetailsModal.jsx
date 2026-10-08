'use client'
import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import {
  formatCurrency, formatDate, formatMonth, getTotalDue, getBalance, getPaymentEntries, PAYMENT_METHOD_LABELS,
} from '@/utils/helpers'
import { useAsyncAction } from '@/hooks/useAsyncAction'
import Badge from '@/components/ui/Badge'
import FormError from '@/components/ui/FormError'

/**
 * Shows every amount received for one month's dues, lets the owner undo a
 * mistaken entry, adjust the rent due for that month, or delete an empty due.
 */
export default function PaymentDetailsModal({ payment, tenantName, onDeleteEntry, onUpdateDue, onDeleteDue, onClose }) {
  const [rent, setRent] = useState(String(payment.rentAmount ?? 0))
  const [notes, setNotes] = useState(payment.notes ?? '')
  const [confirmingEntry, setConfirmingEntry] = useState(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const entries = getPaymentEntries(payment)

  const save = useAsyncAction(onUpdateDue)
  const removeEntry = useAsyncAction(onDeleteEntry)
  const removeDue = useAsyncAction(onDeleteDue)
  const error = save.error || removeEntry.error || removeDue.error
  const dirty = Number(rent) !== payment.rentAmount || notes !== (payment.notes ?? '')

  return (
    <div className="space-y-5">
      <div className="bg-slate-50 rounded-xl p-4 space-y-2 text-sm">
        <div className="flex justify-between"><span className="text-slate-500">Tenant</span><span className="font-medium text-slate-900">{tenantName}</span></div>
        <div className="flex justify-between"><span className="text-slate-500">Month</span><span className="text-slate-900">{formatMonth(payment.month)}</span></div>
        <div className="flex justify-between"><span className="text-slate-500">Rent</span><span className="text-slate-900">{formatCurrency(payment.rentAmount)}</span></div>
        <div className="flex justify-between"><span className="text-slate-500">Utility share</span><span className="text-slate-900">{formatCurrency(payment.utilityShare)}</span></div>
        <div className="flex justify-between border-t border-slate-200 pt-2"><span className="text-slate-700 font-medium">Total due</span><span className="font-semibold text-slate-900">{formatCurrency(getTotalDue(payment))}</span></div>
        <div className="flex justify-between"><span className="text-slate-700 font-medium">Balance</span><span className="font-bold text-amber-700">{formatCurrency(getBalance(payment))}</span></div>
        <div className="flex justify-between items-center"><span className="text-slate-500">Status</span><Badge status={payment.status} /></div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-slate-900 mb-2">Payments received</h3>
        {entries.length === 0 ? (
          <p className="text-sm text-slate-400">Nothing received yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100 border border-slate-100 rounded-xl">
            {entries.map(entry => (
              <li key={entry.id} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900">{formatCurrency(entry.amount)} <span className="text-slate-400 font-normal">· {PAYMENT_METHOD_LABELS[entry.method] ?? entry.method}</span></p>
                  <p className="text-xs text-slate-400 truncate">{formatDate(entry.date)}{entry.note ? ` · ${entry.note}` : ''}</p>
                </div>
                {!entry.legacy && (
                  confirmingEntry === entry.id ? (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button onClick={() => setConfirmingEntry(null)} className="text-xs text-slate-500 px-2 py-1">Keep</button>
                      <button
                        disabled={removeEntry.busy}
                        onClick={async () => { await removeEntry.run(entry.id); setConfirmingEntry(null) }}
                        className="text-xs font-semibold text-white bg-red-600 hover:bg-red-500 px-2.5 py-1 rounded-lg disabled:opacity-60"
                      >
                        {removeEntry.busy ? 'Removing…' : 'Remove'}
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmingEntry(entry.id)} aria-label="Remove this payment entry" className="text-slate-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 shrink-0">
                      <Trash2 size={14} />
                    </button>
                  )
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <form
        onSubmit={e => { e.preventDefault(); save.run({ rentAmount: Number(rent), notes }) }}
        className="space-y-3"
      >
        <h3 className="text-sm font-semibold text-slate-900">Adjust this month</h3>
        <div>
          <label htmlFor="due-rent" className="block text-slate-600 text-xs font-medium mb-1">Rent due for {formatMonth(payment.month)} (e.g. discount or pro-rated first month)</label>
          <input id="due-rent" type="number" min="0" step="1" value={rent} onChange={e => setRent(e.target.value)}
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-indigo-500" />
        </div>
        <div>
          <label htmlFor="due-notes" className="block text-slate-600 text-xs font-medium mb-1">Notes</label>
          <input id="due-notes" type="text" maxLength={500} value={notes} onChange={e => setNotes(e.target.value)}
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-indigo-500" />
        </div>
        <FormError message={error} />
        <div className="flex items-center justify-between gap-3 pt-1">
          {entries.length === 0 ? (
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
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-xl hover:border-slate-300">Close</button>
            <button type="submit" disabled={!dirty || save.busy} className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl disabled:opacity-50">
              {save.busy ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
