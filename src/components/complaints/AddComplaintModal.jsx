'use client'
import { useState } from 'react'

const CATEGORIES = [
  { value: 'plumbing',    label: 'Plumbing'        },
  { value: 'electrical',  label: 'Electrical'      },
  { value: 'wifi',        label: 'WiFi / Internet' },
  { value: 'furniture',   label: 'Furniture'       },
  { value: 'cleaning',    label: 'Cleaning'        },
  { value: 'security',    label: 'Security'        },
  { value: 'noise',       label: 'Noise Complaint' },
  { value: 'other',       label: 'Other'           },
]

const PRIORITIES = [
  { value: 'high',   label: 'High — Urgent' },
  { value: 'medium', label: 'Medium'        },
  { value: 'low',    label: 'Low'           },
]

export default function AddComplaintModal({ tenants, onSubmit, onClose }) {
  const [form, setForm] = useState({
    tenantId: tenants[0]?.id ?? '',
    category: 'plumbing',
    priority: 'medium',
    description: '',
  })
  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }))

  function handleSubmit(e) {
    e.preventDefault()
    const tenant = tenants.find(t => t.id === form.tenantId)
    onSubmit({ ...form, tenantName: tenant?.name ?? '', room: tenant?.room ?? '' })
  }

  const selectCls = 'w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-indigo-500 transition-colors'

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-slate-700 text-sm font-medium mb-1.5">Tenant *</label>
        <select required value={form.tenantId} onChange={e => set('tenantId', e.target.value)} className={selectCls}>
          {tenants.map(t => (
            <option key={t.id} value={t.id}>{t.name} — Room {t.room}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-slate-700 text-sm font-medium mb-1.5">Category *</label>
          <select value={form.category} onChange={e => set('category', e.target.value)} className={selectCls}>
            {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-slate-700 text-sm font-medium mb-1.5">Priority *</label>
          <select value={form.priority} onChange={e => set('priority', e.target.value)} className={selectCls}>
            {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-slate-700 text-sm font-medium mb-1.5">Description *</label>
        <textarea
          required
          rows={4}
          value={form.description}
          onChange={e => set('description', e.target.value)}
          placeholder="Describe the issue in detail…"
          className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition-colors resize-none"
        />
      </div>

      <div className="flex items-center justify-end gap-3 pt-2">
        <button type="button" onClick={onClose} className="px-5 py-2.5 text-sm font-medium text-slate-600 border border-slate-200 rounded-xl hover:border-slate-300 transition-colors">
          Cancel
        </button>
        <button type="submit" className="px-5 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-colors">
          Log complaint
        </button>
      </div>
    </form>
  )
}
