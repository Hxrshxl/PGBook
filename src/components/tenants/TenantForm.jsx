'use client'
import { useState } from 'react'

const ID_TYPES = [
  { value: 'aadhaar',  label: 'Aadhaar Card'      },
  { value: 'passport', label: 'Passport'           },
  { value: 'dl',       label: "Driver's License"   },
  { value: 'voter',    label: 'Voter ID'           },
  { value: 'other',    label: 'Other'              },
]

const defaultForm = {
  name: '', phone: '', email: '', room: '', rentAmount: '',
  moveInDate: new Date().toISOString().split('T')[0],
  idType: 'aadhaar', idNumber: '',
  emergencyContact: { name: '', phone: '', relation: '' },
}

export default function TenantForm({ initialData, onSubmit, onCancel }) {
  const [form, setForm] = useState(
    initialData
      ? { ...defaultForm, ...initialData, emergencyContact: initialData.emergencyContact ?? defaultForm.emergencyContact }
      : defaultForm
  )

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }))
  const setEC = (k, v) => setForm(prev => ({ ...prev, emergencyContact: { ...prev.emergencyContact, [k]: v } }))

  function handleSubmit(e) {
    e.preventDefault()
    onSubmit({ ...form, rentAmount: Number(form.rentAmount) })
  }

  const inputCls = 'w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition-colors'

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Name + Phone */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-slate-700 text-sm font-medium mb-1.5">Full name *</label>
          <input required value={form.name} onChange={e => set('name', e.target.value)} placeholder="Ravi Sharma" className={inputCls} />
        </div>
        <div>
          <label className="block text-slate-700 text-sm font-medium mb-1.5">Phone *</label>
          <input required type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="9876543210" className={inputCls} />
        </div>
      </div>

      {/* Email */}
      <div>
        <label className="block text-slate-700 text-sm font-medium mb-1.5">Email <span className="text-slate-400 font-normal">(optional)</span></label>
        <input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="ravi@example.com" className={inputCls} />
      </div>

      {/* Room + Rent + Move-in */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-slate-700 text-sm font-medium mb-1.5">Room *</label>
          <input required value={form.room} onChange={e => set('room', e.target.value)} placeholder="A-204" className={inputCls} />
        </div>
        <div>
          <label className="block text-slate-700 text-sm font-medium mb-1.5">Monthly rent *</label>
          <input required type="number" min="0" value={form.rentAmount} onChange={e => set('rentAmount', e.target.value)} placeholder="10000" className={inputCls} />
        </div>
        <div>
          <label className="block text-slate-700 text-sm font-medium mb-1.5">Move-in date *</label>
          <input required type="date" value={form.moveInDate} onChange={e => set('moveInDate', e.target.value)} className={inputCls} />
        </div>
      </div>

      {/* ID */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-slate-700 text-sm font-medium mb-1.5">ID type</label>
          <select value={form.idType} onChange={e => set('idType', e.target.value)} className={inputCls}>
            {ID_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-slate-700 text-sm font-medium mb-1.5">ID number</label>
          <input value={form.idNumber} onChange={e => set('idNumber', e.target.value)} placeholder="XXXX-XXXX-1234" className={inputCls} />
        </div>
      </div>

      {/* Emergency contact */}
      <div>
        <p className="text-slate-700 text-sm font-medium mb-2">Emergency contact</p>
        <div className="grid grid-cols-3 gap-3">
          <input value={form.emergencyContact.name}     onChange={e => setEC('name', e.target.value)}     placeholder="Contact name" className={inputCls} />
          <input value={form.emergencyContact.phone}    onChange={e => setEC('phone', e.target.value)}    placeholder="Phone"        type="tel" className={inputCls} />
          <input value={form.emergencyContact.relation} onChange={e => setEC('relation', e.target.value)} placeholder="Relation"     className={inputCls} />
        </div>
      </div>

      {/* Buttons */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <button type="button" onClick={onCancel} className="px-5 py-2.5 text-sm font-medium text-slate-600 border border-slate-200 rounded-xl hover:border-slate-300 transition-colors">
          Cancel
        </button>
        <button type="submit" className="px-5 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-colors">
          {initialData ? 'Save changes' : 'Add tenant'}
        </button>
      </div>
    </form>
  )
}
