'use client'
import { useCallback, useEffect, useState } from 'react'
import { Megaphone, Pin, Plus, Trash2, CheckCheck } from 'lucide-react'
import { api } from '@/utils/api'
import { useAppData } from '@/context/AppContext'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { useAsyncAction } from '@/hooks/useAsyncAction'
import { timeAgo } from '@/utils/helpers'
import Modal from '@/components/ui/Modal'
import EmptyState from '@/components/ui/EmptyState'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import FormError from '@/components/ui/FormError'
import Spinner from '@/components/ui/Spinner'

const inputCls = 'w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition-colors'
const labelCls = 'block text-slate-700 text-sm font-medium mb-1.5'

function NoticeForm({ properties, defaultPropertyId, onSubmit, onCancel }) {
  const [form, setForm] = useState({ title: '', body: '', propertyIds: defaultPropertyId ? [defaultPropertyId] : [], pinned: false, requiresAck: false })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const toggle = id => set('propertyIds', form.propertyIds.includes(id) ? form.propertyIds.filter(x => x !== id) : [...form.propertyIds, id])
  const { run, busy, error } = useAsyncAction(onSubmit)
  return (
    <form onSubmit={e => { e.preventDefault(); run(form) }} className="space-y-4">
      <div>
        <label htmlFor="n-title" className={labelCls}>Title *</label>
        <input id="n-title" required maxLength={120} value={form.title} onChange={e => set('title', e.target.value)} placeholder="Water supply off on Sunday 10 am – 2 pm" className={inputCls} />
      </div>
      <div>
        <label htmlFor="n-body" className={labelCls}>Message</label>
        <textarea id="n-body" rows={4} maxLength={3000} value={form.body} onChange={e => set('body', e.target.value)} placeholder="Please store water the night before." className={`${inputCls} resize-none`} />
      </div>
      {properties.length > 1 && (
        <fieldset>
          <legend className={labelCls}>Show to</legend>
          <label className="flex items-center gap-2 text-sm text-slate-700 mb-2">
            <input type="checkbox" checked={form.propertyIds.length === 0} onChange={() => set('propertyIds', form.propertyIds.length ? [] : [properties[0].id])} className="accent-indigo-600" />
            Tenants of all properties
          </label>
          {form.propertyIds.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-6">
              {properties.map(p => (
                <label key={p.id} className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={form.propertyIds.includes(p.id)} onChange={() => toggle(p.id)} className="accent-indigo-600" /> {p.name}
                </label>
              ))}
            </div>
          )}
        </fieldset>
      )}
      <div className="flex flex-wrap gap-5">
        <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={form.pinned} onChange={e => set('pinned', e.target.checked)} className="accent-indigo-600" /> Pin to the top</label>
        <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={form.requiresAck} onChange={e => set('requiresAck', e.target.checked)} className="accent-indigo-600" /> Ask tenants to confirm they read it</label>
      </div>
      <FormError message={error} />
      <div className="flex justify-end gap-3">
        <button type="button" onClick={onCancel} disabled={busy} className="px-5 py-2.5 text-sm font-medium text-slate-600 border border-slate-200 rounded-xl hover:border-slate-300 disabled:opacity-50">Cancel</button>
        <button type="submit" disabled={busy} className="px-5 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl disabled:opacity-60">{busy ? 'Publishing…' : 'Publish notice'}</button>
      </div>
    </form>
  )
}

export default function NoticesPage() {
  const { properties, propertyById, selectedPropertyId, tenants } = useAppData()
  const { can } = useAuth()
  const { showToast } = useToast()
  const canManage = can('notices.manage')
  const [notices, setNotices] = useState(null)
  const [error, setError] = useState('')
  const [adding, setAdding] = useState(false)
  const [archiving, setArchiving] = useState(null)

  const load = useCallback(() => api.get('/notices').then(setNotices).catch(e => setError(e.message)), [])
  useEffect(() => { load() }, [load])

  const inScope = n => selectedPropertyId === 'all' || !n.propertyIds.length || n.propertyIds.includes(selectedPropertyId)
  const audience = n => (n.propertyIds.length ? n.propertyIds.map(id => propertyById.get(id)?.name ?? 'Archived property').join(', ') : 'All properties')
  const appUsers = n => tenants.filter(t => t.status === 'active' && t.residentId && (!n.propertyIds.length || n.propertyIds.includes(t.propertyId))).length

  async function handleAdd(data) {
    await api.post('/notices', data)
    setAdding(false)
    showToast('Notice published. Tenants using the app will see it.')
    load()
  }
  async function handleArchive() {
    await api.delete(`/notices/${archiving.id}`)
    showToast('Notice taken down.', 'warning')
    setArchiving(null)
    load()
  }

  if (!notices) return <div className="flex justify-center py-24">{error ? <div className="max-w-sm w-full px-4"><FormError message={error} /></div> : <Spinner size={26} />}</div>
  const visible = notices.filter(inScope)

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Notices</h1>
          <p className="text-slate-500 text-sm mt-1">Announcements your tenants see in the PGBook tenant app</p>
        </div>
        {canManage && (
          <button onClick={() => setAdding(true)} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm px-4 py-2.5 rounded-xl shrink-0">
            <Plus size={16} /> <span className="hidden sm:inline">New notice</span>
          </button>
        )}
      </div>

      {visible.length === 0 ? (
        <EmptyState icon={Megaphone} title="No notices" message="Post water cuts, rule changes or the food menu. Tenants using the app see them right away." actionLabel={canManage ? 'New notice' : undefined} onAction={() => setAdding(true)} />
      ) : (
        <ul className="space-y-3">
          {visible.map(n => (
            <li key={n.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-900 flex items-center gap-2">{n.pinned && <Pin size={14} className="text-indigo-500" />}{n.title}</p>
                  {n.body && <p className="text-sm text-slate-600 mt-1 whitespace-pre-line">{n.body}</p>}
                  <p className="text-xs text-slate-400 mt-2">{audience(n)} · {timeAgo(n.createdAt)}{n.createdBy?.name ? ` · by ${n.createdBy.name}` : ''}</p>
                  {n.requiresAck && (
                    <p className="text-xs text-slate-600 mt-1 flex items-center gap-1"><CheckCheck size={13} className="text-emerald-600" /> Read by {n.acks.length} of {appUsers(n)} tenants using the app{n.acks.length ? `: ${n.acks.slice(0, 5).map(a => a.name).join(', ')}${n.acks.length > 5 ? '…' : ''}` : ''}</p>
                  )}
                </div>
                {canManage && (
                  <button onClick={() => setArchiving(n)} aria-label="Take down notice" className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-slate-50"><Trash2 size={15} /></button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal isOpen={adding} onClose={() => setAdding(false)} title="New notice" maxWidth="max-w-xl">
        {adding && <NoticeForm properties={properties} defaultPropertyId={selectedPropertyId !== 'all' ? selectedPropertyId : null} onSubmit={handleAdd} onCancel={() => setAdding(false)} />}
      </Modal>
      <ConfirmDialog
        isOpen={!!archiving}
        title="Take this notice down?"
        message="Tenants will no longer see it. It stays in your activity log."
        confirmLabel="Take down"
        onConfirm={handleArchive}
        onCancel={() => setArchiving(null)}
      />
    </div>
  )
}
