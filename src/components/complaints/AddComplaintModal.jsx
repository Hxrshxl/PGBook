'use client'
import { useState } from 'react'
import { useAsyncAction } from '@/hooks/useAsyncAction'
import FormError from '@/components/ui/FormError'

export const CATEGORIES = [
  { value: 'plumbing',    label: 'Plumbing'        },
  { value: 'electrical',  label: 'Electrical'      },
  { value: 'wifi',        label: 'WiFi / Internet' },
  { value: 'furniture',   label: 'Furniture'       },
  { value: 'cleaning',    label: 'Cleaning'        },
  { value: 'security',    label: 'Security'        },
  { value: 'noise',       label: 'Noise'           },
  { value: 'other',       label: 'Other'           },
]

const PRIORITIES = [
  { value: 'high',   label: 'High — Urgent' },
  { value: 'medium', label: 'Medium'        },
  { value: 'low',    label: 'Low'           },
]

// onSubmit should throw on failure; the error is shown inside the form.
export default function AddComplaintModal({ tenants, onSubmit, onClose }) {
  const [form, setForm] = useState({
    tenantId: tenants[0]?.id ?? '',
    category: 'plumbing',
    priority: 'medium',
    description: '',
  })
  const { run, busy, error } = useAsyncAction(onSubmit)
  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }))

  function handleSubmit(e) {
    e.preventDefault()
    run(form)
  }

  const selectCls = 'w-full border border-slate-200 rounded-md px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-indigo-500 transition-colors bg-white'

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="c-tenant" className="block text-[13px] font-medium text-slate-700 mb-1.5">Tenant *</label>
        <select id="c-tenant" required value={form.tenantId} onChange={e => set('tenantId', e.target.value)} className={selectCls}>
          {tenants.map(t => (
            <option key={t.id} value={t.id}>{t.name} — Room {t.room}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="c-category" className="block text-[13px] font-medium text-slate-700 mb-1.5">Category *</label>
          <select id="c-category" value={form.category} onChange={e => set('category', e.target.value)} className={selectCls}>
            {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="c-priority" className="block text-[13px] font-medium text-slate-700 mb-1.5">Priority *</label>
          <select id="c-priority" value={form.priority} onChange={e => set('priority', e.target.value)} className={selectCls}>
            {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="c-desc" className="block text-[13px] font-medium text-slate-700 mb-1.5">Description *</label>
        <textarea
          id="c-desc"
          required
          rows={4}
          maxLength={2000}
          value={form.description}
          onChange={e => set('description', e.target.value)}
          placeholder="Describe the issue in detail…"
          className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 transition-colors resize-none bg-white"
        />
      </div>

      <FormError message={error} />

      <div className="flex items-center justify-end gap-3 pt-2">
        <button type="button" onClick={onClose} disabled={busy} className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap h-9 px-3.5 text-sm rounded-md border border-slate-200 bg-white font-medium text-slate-700 shadow-xs transition-colors hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50">
          Cancel
        </button>
        <button type="submit" disabled={busy} className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap h-9 px-3.5 text-sm rounded-md bg-indigo-600 font-medium text-white shadow-xs transition-colors hover:bg-indigo-700 disabled:opacity-50">
          {busy ? 'Saving…' : 'Log complaint'}
        </button>
      </div>
    </form>
  )
}
