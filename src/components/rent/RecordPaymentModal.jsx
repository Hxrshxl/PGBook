'use client'
import { useState } from 'react'
import { formatCurrency, getTotalDue, getBalance, calcPaymentStatus } from '../../utils/helpers'

export default function RecordPaymentModal({ payment, tenantName, onSubmit, onClose }) {
  const [amount, setAmount] = useState(() => String(getBalance(payment)))
  const [notes, setNotes] = useState('')

  const totalDue = getTotalDue(payment)
  const amountNum = Math.max(0, Number(amount) || 0)
  const newPaid = (payment.amountPaid ?? 0) + amountNum
  const newStatus = calcPaymentStatus(newPaid, totalDue)

  function handleSubmit(e) {
    e.preventDefault()
    onSubmit({ amount: amountNum, notes })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Summary */}
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
        <div className="flex justify-between text-sm border-t border-slate-200 pt-2">
          <span className="text-slate-700 font-medium">Balance remaining</span>
          <span className="text-amber-700 font-bold">{formatCurrency(getBalance(payment))}</span>
        </div>
      </div>

      {/* Amount */}
      <div>
        <label className="block text-slate-700 text-sm font-medium mb-1.5">Amount received *</label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm font-medium">₹</span>
          <input
            required
            type="number"
            min="1"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            className="w-full border border-slate-200 rounded-xl pl-7 pr-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>
        {amountNum > 0 && (
          <p className="text-xs text-slate-500 mt-1.5">
            Status after recording:{' '}
            <span className={newStatus === 'paid' ? 'text-emerald-600 font-medium' : newStatus === 'partial' ? 'text-blue-600 font-medium' : 'text-amber-600 font-medium'}>
              {newStatus.charAt(0).toUpperCase() + newStatus.slice(1)}
            </span>
          </p>
        )}
      </div>

      {/* Notes */}
      <div>
        <label className="block text-slate-700 text-sm font-medium mb-1.5">
          Notes <span className="text-slate-400 font-normal">(optional)</span>
        </label>
        <input
          type="text"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="e.g. Cash, UPI ref #12345"
          className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition-colors"
        />
      </div>

      <div className="flex items-center justify-end gap-3 pt-2">
        <button type="button" onClick={onClose} className="px-5 py-2.5 text-sm font-medium text-slate-600 border border-slate-200 rounded-xl hover:border-slate-300 transition-colors">
          Cancel
        </button>
        <button type="submit" className="px-5 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-colors">
          Record payment
        </button>
      </div>
    </form>
  )
}
