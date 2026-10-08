'use client'
import { useState } from 'react'
import { todayISO } from '@/utils/helpers'
import { useAsyncAction } from '@/hooks/useAsyncAction'
import FormError from '@/components/ui/FormError'

const ID_TYPES = [
  { value: 'aadhaar',  label: 'Aadhaar Card'     },
  { value: 'pan',      label: 'PAN Card'         },
  { value: 'passport', label: 'Passport'         },
  { value: 'dl',       label: "Driver's License" },
  { value: 'voter',    label: 'Voter ID'         },
  { value: 'other',    label: 'Other'            },
]

function initialForm(initialData) {
  const base = {
    name: '', phone: '', email: '', room: '', rentAmount: '', depositAmount: '',
    moveInDate: todayISO(), idType: 'aadhaar', idNumber: '', notes: '',
    emergencyContact: { name: '', phone: '', relation: '' },
  }
  if (!initialData) return base
  return {
    ...base,
    ...Object.fromEntries(Object.keys(base).map(k => [k, initialData[k] ?? base[k]])),
    rentAmount: String(initialData.rentAmount ?? ''),
    depositAmount: initialData.depositAmount ? String(initialData.depositAmount) : '',
    emergencyContact: { ...base.emergencyContact, ...initialData.emergencyContact },
  }
}

// onSubmit should throw on failure; the error is shown inside the form.
export default function TenantForm({ initialData, onSubmit, onCancel }) {
  const [form, setForm] = useState(() => initialForm(initialData))
  const { run, busy, error } = useAsyncAction(onSubmit)

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }))
  const setEC = (k, v) => setForm(prev => ({ ...prev, emergencyContact: { ...prev.emergencyContact, [k]: v } }))

  function handleSubmit(e) {
    e.preventDefault()
    run({
      ...form,
      rentAmount: Number(form.rentAmount),
      depositAmount: Number(form.depositAmount) || 0,
    })
  }

  const inputCls = 'w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition-colors'
  const labelCls = 'block text-slate-700 text-sm font-medium mb-1.5'

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="t-name" className={labelCls}>Full name *</label>
          <input id="t-name" required maxLength={100} value={form.name} onChange={e => set('name', e.target.value)} placeholder="Ravi Sharma" className={inputCls} />
        </div>
        <div>
          <label htmlFor="t-phone" className={labelCls}>Phone *</label>
          <input id="t-phone" required type="tel" inputMode="tel" minLength={10} maxLength={20} title="At least 10 digits"
            value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="9876543210" className={inputCls} />
        </div>
      </div>

      <div>
        <label htmlFor="t-email" className={labelCls}>Email <span className="text-slate-400 font-normal">(optional)</span></label>
        <input id="t-email" type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="ravi@example.com" className={inputCls} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div>
          <label htmlFor="t-room" className={labelCls}>Room *</label>
          <input id="t-room" required maxLength={20} value={form.room} onChange={e => set('room', e.target.value)} placeholder="A-204" className={inputCls} />
        </div>
        <div>
          <label htmlFor="t-rent" className={labelCls}>Monthly rent *</label>
          <input id="t-rent" required type="number" min="0" step="1" inputMode="numeric" value={form.rentAmount} onChange={e => set('rentAmount', e.target.value)} placeholder="10000" className={inputCls} />
        </div>
        <div>
          <label htmlFor="t-deposit" className={labelCls}>Deposit</label>
          <input id="t-deposit" type="number" min="0" step="1" inputMode="numeric" value={form.depositAmount} onChange={e => set('depositAmount', e.target.value)} placeholder="20000" className={inputCls} />
        </div>
        <div>
          <label htmlFor="t-movein" className={labelCls}>Move-in *</label>
          <input id="t-movein" required type="date" value={form.moveInDate} onChange={e => set('moveInDate', e.target.value)} className={inputCls} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="t-idtype" className={labelCls}>ID type</label>
          <select id="t-idtype" value={form.idType} onChange={e => set('idType', e.target.value)} className={inputCls}>
            {ID_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="t-idnum" className={labelCls}>ID number</label>
          <input id="t-idnum" maxLength={50} value={form.idNumber} onChange={e => set('idNumber', e.target.value)} placeholder="XXXX-XXXX-1234" className={inputCls} />
        </div>
      </div>

      <div>
        <p className="text-slate-700 text-sm font-medium mb-2">Emergency contact</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input aria-label="Emergency contact name" maxLength={100} value={form.emergencyContact.name} onChange={e => setEC('name', e.target.value)} placeholder="Contact name" className={inputCls} />
          <input aria-label="Emergency contact phone" maxLength={20} value={form.emergencyContact.phone} onChange={e => setEC('phone', e.target.value)} placeholder="Phone" type="tel" className={inputCls} />
          <input aria-label="Emergency contact relation" maxLength={50} value={form.emergencyContact.relation} onChange={e => setEC('relation', e.target.value)} placeholder="Relation" className={inputCls} />
        </div>
      </div>

      <div>
        <label htmlFor="t-notes" className={labelCls}>Notes <span className="text-slate-400 font-normal">(optional)</span></label>
        <textarea id="t-notes" rows={2} maxLength={1000} value={form.notes} onChange={e => set('notes', e.target.value)}
          placeholder="e.g. Food preference, vehicle number, company" className={`${inputCls} resize-none`} />
      </div>

      <FormError message={error} />

      <div className="flex items-center justify-end gap-3 pt-2">
        <button type="button" onClick={onCancel} disabled={busy} className="px-5 py-2.5 text-sm font-medium text-slate-600 border border-slate-200 rounded-xl hover:border-slate-300 transition-colors disabled:opacity-50">
          Cancel
        </button>
        <button type="submit" disabled={busy} className="px-5 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-colors disabled:opacity-60">
          {busy ? 'Saving…' : initialData ? 'Save changes' : 'Add tenant'}
        </button>
      </div>
    </form>
  )
}
