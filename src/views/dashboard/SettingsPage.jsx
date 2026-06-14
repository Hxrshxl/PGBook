'use client'
import { useState } from 'react'
import { useAppData } from '@/context/AppContext'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'

const FIELD_GROUPS = [
  {
    title: 'PG Details',
    fields: [
      { key: 'pgName',    label: 'PG Name',  placeholder: 'Sunrise PG',                        required: true  },
      { key: 'address',   label: 'Address',   placeholder: '42, 3rd Cross, Koramangala, Bangalore', required: false },
    ],
  },
  {
    title: 'Owner Details',
    fields: [
      { key: 'ownerName', label: 'Owner Name', placeholder: 'Your full name',  required: false },
      { key: 'phone',     label: 'Phone',       placeholder: '9876543210',      required: false, type: 'tel' },
    ],
  },
  {
    title: 'Payment Details',
    fields: [
      { key: 'upiId',    label: 'UPI ID',    placeholder: 'yourpg@upi',  required: false },
      { key: 'logoText', label: 'Brand Name', placeholder: 'Sunrise PG', required: false },
    ],
  },
]

export default function SettingsPage() {
  const { pgSettings, updateSettings } = useAppData()
  const { user } = useAuth()
  const { showToast } = useToast()
  const [form, setForm] = useState({ ...pgSettings })
  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }))

  async function handleSave(e) {
    e.preventDefault()
    try {
      await updateSettings(form)
      showToast('Settings saved successfully.')
    } catch (err) {
      showToast(err.message ?? 'Failed to save settings.', 'error')
    }
  }

  const inputCls = 'w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition-colors'

  return (
    <div className="p-6 lg:p-8 max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-slate-500 text-sm mt-1">Configure your PG details, owner info, and payment settings</p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {FIELD_GROUPS.map(group => (
          <div key={group.title} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
              <h2 className="font-semibold text-slate-900 text-sm">{group.title}</h2>
            </div>
            <div className="p-6 space-y-4">
              {group.fields.map(f => (
                <div key={f.key}>
                  <label className="block text-slate-700 text-sm font-medium mb-1.5">{f.label}{f.required && ' *'}</label>
                  <input type={f.type ?? 'text'} required={f.required} value={form[f.key] ?? ''} onChange={e => set(f.key, e.target.value)} placeholder={f.placeholder} className={inputCls} />
                </div>
              ))}
            </div>
          </div>
        ))}

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
            <h2 className="font-semibold text-slate-900 text-sm">Account</h2>
          </div>
          <div className="p-6 space-y-4">
            {[
              { label: 'Name',  value: user?.name  },
              { label: 'Email', value: user?.email },
              { label: 'Plan',  value: user?.plan ?? 'Pro' },
            ].map(f => (
              <div key={f.label} className="flex items-center justify-between">
                <span className="text-sm text-slate-500">{f.label}</span>
                <span className="text-sm font-medium text-slate-900 capitalize">{f.value ?? '—'}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3">
          <button type="button" onClick={() => setForm({ ...pgSettings })} className="px-5 py-2.5 text-sm font-medium text-slate-600 border border-slate-200 rounded-xl hover:border-slate-300 transition-colors">
            Reset changes
          </button>
          <button type="submit" className="px-6 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-colors">
            Save settings
          </button>
        </div>
      </form>
    </div>
  )
}
