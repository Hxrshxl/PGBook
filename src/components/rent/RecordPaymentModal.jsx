'use client'
import { useState } from 'react'
import { formatCurrency, getTotalDue, getBalance, calcPaymentStatus, roundMoney, todayISO, PAYMENT_METHOD_LABELS } from '@/utils/helpers'
import { useAsyncAction } from '@/hooks/useAsyncAction'
import FormError from '@/components/ui/FormError'

// onSubmit({ amount, date, method, note }) should throw on failure.
// mode 'cash': a caretaker logging cash they received; it counts once someone confirms the handover.
export default function RecordPaymentModal({ payment, tenantName, pendingCash = [], mode = 'record', onSubmit, onClose }) {
  const cashMode = mode === 'cash'
  const pendingCashTotal = roundMoney(pendingCash.reduce((s, c) => s + c.amount, 0))
  const balance = cashMode ? Math.max(0, roundMoney(getBalance(payment) - pendingCashTotal)) : getBalance(payment)
  const [amount, setAmount] = useState(() => String(balance))
  const [date, setDate] = useState(todayISO)
  const [method, setMethod] = useState('upi')
  const [note, setNote] = useState('')
  const { run, busy, error } = useAsyncAction(onSubmit)

  const totalDue = getTotalDue(payment)
  const amountNum = Math.max(0, roundMoney(amount))
  const newStatus = calcPaymentStatus((payment.amountPaid ?? 0) + amountNum, totalDue)

  function handleSubmit(e) {
    e.preventDefault()
    run(cashMode ? { amount: amountNum, date, note } : { amount: amountNum, date, method, note })
  }

  const inputCls = 'w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition-colors'

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="bg-slate-50 rounded-xl p-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-slate-500">Tenant</span>
          <span className="text-slate-900 font-medium">{tenantName}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-500">Total due</span>
          <span className="text-slate-900 font-semibold">{formatCurrency(totalDue)}</span>
        </div>
        {payment.amountPaid > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Already paid</span>
            <span className="text-emerald-600 font-medium">{formatCurrency(payment.amountPaid)}</span>
          </div>
        )}
        {pendingCashTotal > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Cash awaiting confirmation</span>
            <span className="text-amber-700 font-medium">{formatCurrency(pendingCashTotal)}</span>
          </div>
        )}
        <div className="flex justify-between text-sm border-t border-slate-200 pt-2">
          <span className="text-slate-700 font-medium">{cashMode ? 'Still to collect' : 'Balance remaining'}</span>
          <span className="text-amber-700 font-bold">{formatCurrency(balance)}</span>
        </div>
      </div>
      {cashMode ? (
        <p className="text-xs text-slate-500">Log cash you received from the tenant. It is added to their payments once the owner or accountant confirms you handed it over.</p>
      ) : pendingCashTotal > 0 && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
          {formatCurrency(pendingCashTotal)} cash collected by staff is waiting in Approvals. Confirm it there instead of recording it again here.
        </p>
      )}

      <div>
        <label htmlFor="pay-amount" className="block text-slate-700 text-sm font-medium mb-1.5">Amount received *</label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm font-medium">₹</span>
          <input id="pay-amount" required type="number" min="1" max={balance} step="0.01" inputMode="decimal" autoFocus
            value={amount} onChange={e => setAmount(e.target.value)} className={`${inputCls} pl-7`} />
        </div>
        {amountNum > 0 && !cashMode && (
          <p className="text-xs text-slate-500 mt-1.5">
            Status after recording:{' '}
            <span className={newStatus === 'paid' ? 'text-emerald-600 font-medium' : 'text-blue-600 font-medium'}>
              {newStatus === 'paid' ? 'Paid in full' : 'Partially paid'}
            </span>
          </p>
        )}
      </div>

      <div className={`grid gap-3 ${cashMode ? 'grid-cols-1' : 'grid-cols-2'}`}>
        <div>
          <label htmlFor="pay-date" className="block text-slate-700 text-sm font-medium mb-1.5">Date received</label>
          <input id="pay-date" required type="date" max={todayISO()} value={date} onChange={e => setDate(e.target.value)} className={inputCls} />
        </div>
        {!cashMode && <div>
          <label htmlFor="pay-method" className="block text-slate-700 text-sm font-medium mb-1.5">Method</label>
          <select id="pay-method" value={method} onChange={e => setMethod(e.target.value)} className={inputCls}>
            {Object.entries(PAYMENT_METHOD_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </div>}
      </div>

      <div>
        <label htmlFor="pay-note" className="block text-slate-700 text-sm font-medium mb-1.5">
          Reference / note <span className="text-slate-400 font-normal">(optional)</span>
        </label>
        <input id="pay-note" type="text" maxLength={200} value={note} onChange={e => setNote(e.target.value)} placeholder={cashMode ? 'e.g. Paid at the gate, 500×4 notes' : 'e.g. UPI ref 412345678901'} className={inputCls} />
      </div>

      <FormError message={error} />

      <div className="flex items-center justify-end gap-3 pt-2">
        <button type="button" onClick={onClose} disabled={busy} className="px-5 py-2.5 text-sm font-medium text-slate-600 border border-slate-200 rounded-xl hover:border-slate-300 transition-colors disabled:opacity-50">
          Cancel
        </button>
        <button type="submit" disabled={busy || amountNum <= 0} className="px-5 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-colors disabled:opacity-60">
          {busy ? 'Saving…' : cashMode ? 'Log cash collected' : 'Record payment'}
        </button>
      </div>
    </form>
  )
}
