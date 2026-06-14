'use client'
import { useState } from 'react'
import { formatCurrency } from '../../utils/helpers'

const BILL_TYPES = [
  { value: 'electricity', label: 'Electricity' },
  { value: 'water',       label: 'Water'        },
  { value: 'maintenance', label: 'Maintenance'  },
  { value: 'internet',    label: 'Internet'     },
  { value: 'other',       label: 'Other'        },
]

export default function AddBillModal({ activeTenantCount, defaultMonth, onSubmit, onClose }) {
  const [form, setForm] = useState({ type: 'electricity', totalAmount: '', month: defaultMonth })
  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }))

  const perTenant = activeTenantCount > 0 ? Math.round(Number(form.totalAmount) / activeTenantCount) : 0

  function handleSubmit(e) {
    e.preventDefault()
    onSubmit({ type: form.type, totalAmount: Number(form.totalAmount), month: form.month, perTenantAmount: perTenant })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="block text-slate-700 text-sm font-medium mb-1.5">Bill type *</label>
        <select value={form.type} onChange={e => set('type', e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-indigo-500 transition-colors">
          {BILL_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>

      <div>
        <label className="block text-slate-700 text-sm font-medium mb-1.5">Total bill amount *</label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm font-medium">₹</span>
          <input
            required
            type="number"
            min="1"
            value={form.totalAmount}
            onChange={e => set('totalAmount', e.target.value)}
            placeholder="8800"
            className="w-full border border-slate-200 rounded-xl pl-7 pr-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>
      </div>

      {Number(form.totalAmount) > 0 && (
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3">
          <p className="text-indigo-900 text-sm font-semibold">
            Per tenant: {formatCurrency(perTenant)}
          </p>
          <p className="text-indigo-600 text-xs mt-0.5">
            {formatCurrency(Number(form.totalAmount))} ÷ {activeTenantCount} active tenants, rounded to nearest rupee
          </p>
        </div>
      )}

      {activeTenantCount === 0 && (
        <p className="text-amber-700 text-sm bg-amber-50 rounded-xl px-4 py-3">
          No active tenants found. Add tenants before splitting bills.
        </p>
      )}

      <div className="flex items-center justify-end gap-3 pt-2">
        <button type="button" onClick={onClose} className="px-5 py-2.5 text-sm font-medium text-slate-600 border border-slate-200 rounded-xl hover:border-slate-300 transition-colors">
          Cancel
        </button>
        <button type="submit" disabled={activeTenantCount === 0} className="px-5 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-xl transition-colors">
          Split &amp; add to dues
        </button>
      </div>
    </form>
  )
}
