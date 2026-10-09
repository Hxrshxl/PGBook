'use client'
import { useMemo, useState } from 'react'
import { formatCurrency, formatMonth, getCurrentMonth, isBillableMonth, splitAmount } from '@/utils/helpers'
import { useAsyncAction } from '@/hooks/useAsyncAction'
import FormError from '@/components/ui/FormError'

export const BILL_TYPES = [
  { value: 'electricity', label: 'Electricity' },
  { value: 'water',       label: 'Water'       },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'internet',    label: 'Internet'    },
  { value: 'gas',         label: 'Gas'         },
  { value: 'other',       label: 'Other'       },
]

function defaultSelection(tenants, month) {
  return new Set(tenants.filter(t => t.status === 'active' && isBillableMonth(t.moveInDate, month)).map(t => t.id))
}

// onSubmit({ type, totalAmount, month, tenantIds, note, propertyId }) should throw on failure.
// With several properties and none selected, the bill's property is chosen here (a bill belongs to one building).
export default function AddBillModal({ tenants: allTenants, properties = [], defaultPropertyId, defaultMonth, onSubmit, onClose }) {
  const choosesProperty = !defaultPropertyId && properties.length > 1
  const [propertyId, setPropertyId] = useState(defaultPropertyId ?? properties[0]?.id ?? '')
  const tenants = useMemo(() => (choosesProperty ? allTenants.filter(t => t.propertyId === propertyId) : allTenants), [allTenants, choosesProperty, propertyId])
  const [form, setForm] = useState({ type: 'electricity', totalAmount: '', month: defaultMonth, note: '' })
  const [selected, setSelected] = useState(() => defaultSelection(tenants, defaultMonth))
  const { run, busy, error } = useAsyncAction(onSubmit)
  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }))

  // Active tenants for the month, plus vacated ones in case the bill covers part of their stay.
  const candidates = useMemo(
    () => tenants
      .filter(t => isBillableMonth(t.moveInDate, form.month))
      .sort((a, b) => (a.status === b.status ? a.room.localeCompare(b.room, undefined, { numeric: true }) : a.status === 'active' ? -1 : 1)),
    [tenants, form.month],
  )
  const chosen = candidates.filter(t => selected.has(t.id))
  const total = Number(form.totalAmount) || 0
  const shares = splitAmount(total, chosen.length)

  function changeProperty(id) {
    setPropertyId(id)
    setSelected(defaultSelection(allTenants.filter(t => t.propertyId === id), form.month))
  }

  function changeMonth(month) {
    set('month', month)
    setSelected(defaultSelection(tenants, month))
  }

  function toggle(id) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleSubmit(e) {
    e.preventDefault()
    run({ type: form.type, totalAmount: total, month: form.month, note: form.note, tenantIds: chosen.map(t => t.id), ...(propertyId ? { propertyId } : {}) })
  }

  const inputCls = 'w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-indigo-500 transition-colors'

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {choosesProperty && (
        <div>
          <label htmlFor="bill-prop" className="block text-slate-700 text-sm font-medium mb-1.5">Property *</label>
          <select id="bill-prop" required value={propertyId} onChange={e => changeProperty(e.target.value)} className={inputCls}>
            {properties.map(pr => <option key={pr.id} value={pr.id}>{pr.name}</option>)}
          </select>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="bill-type" className="block text-slate-700 text-sm font-medium mb-1.5">Bill type *</label>
          <select id="bill-type" value={form.type} onChange={e => set('type', e.target.value)} className={inputCls}>
            {BILL_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="bill-month" className="block text-slate-700 text-sm font-medium mb-1.5">Charge to month *</label>
          <input id="bill-month" type="month" required max={getCurrentMonth()} value={form.month} onChange={e => e.target.value && changeMonth(e.target.value)} className={inputCls} />
        </div>
      </div>

      <div>
        <label htmlFor="bill-amount" className="block text-slate-700 text-sm font-medium mb-1.5">Total bill amount *</label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm font-medium">₹</span>
          <input id="bill-amount" required type="number" min="1" step="0.01" inputMode="decimal" value={form.totalAmount}
            onChange={e => set('totalAmount', e.target.value)} placeholder="8800" className={`${inputCls} pl-7`} />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-slate-700 text-sm font-medium">Split between ({chosen.length})</p>
          <div className="flex gap-3 text-xs">
            <button type="button" onClick={() => setSelected(defaultSelection(tenants, form.month))} className="text-indigo-600 hover:text-indigo-700">Active only</button>
            <button type="button" onClick={() => setSelected(new Set())} className="text-slate-500 hover:text-slate-700">Clear</button>
          </div>
        </div>
        {candidates.length === 0 ? (
          <p className="text-amber-700 text-sm bg-amber-50 rounded-xl px-4 py-3">No tenants were living here in {formatMonth(form.month)}.</p>
        ) : (
          <ul className="max-h-48 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100">
            {candidates.map(t => {
              const idx = chosen.findIndex(c => c.id === t.id)
              return (
                <li key={t.id}>
                  <label className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-slate-50">
                    <input type="checkbox" checked={selected.has(t.id)} onChange={() => toggle(t.id)} className="accent-indigo-600" />
                    <span className="flex-1 text-sm text-slate-800">
                      {t.name} <span className="text-slate-400">· Room {t.room}{t.status === 'vacated' ? ' · Vacated' : ''}</span>
                    </span>
                    {idx >= 0 && total > 0 && <span className="text-xs font-medium text-slate-600">{formatCurrency(shares[idx])}</span>}
                  </label>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {total > 0 && chosen.length > 0 && (
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3">
          <p className="text-indigo-900 text-sm font-semibold">
            About {formatCurrency(shares[0])} per tenant
          </p>
          <p className="text-indigo-600 text-xs mt-0.5">
            {formatCurrency(total)} ÷ {chosen.length} — shares add up exactly to the bill, and are added to each tenant&apos;s dues for {formatMonth(form.month)}.
          </p>
        </div>
      )}

      <div>
        <label htmlFor="bill-note" className="block text-slate-700 text-sm font-medium mb-1.5">Note <span className="text-slate-400 font-normal">(optional)</span></label>
        <input id="bill-note" type="text" maxLength={200} value={form.note} onChange={e => set('note', e.target.value)} placeholder="e.g. Meter reading 4521 → 5340" className={inputCls} />
      </div>

      <FormError message={error} />

      <div className="flex items-center justify-end gap-3 pt-2">
        <button type="button" onClick={onClose} disabled={busy} className="px-5 py-2.5 text-sm font-medium text-slate-600 border border-slate-200 rounded-xl hover:border-slate-300 transition-colors disabled:opacity-50">
          Cancel
        </button>
        <button type="submit" disabled={busy || chosen.length === 0 || total <= 0} className="px-5 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-xl transition-colors">
          {busy ? 'Saving…' : 'Split & add to dues'}
        </button>
      </div>
    </form>
  )
}
