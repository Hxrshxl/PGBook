'use client'
import { useCallback, useEffect, useState } from 'react'
import { Camera, Plus, X } from 'lucide-react'
import { useResident } from '@/context/ResidentContext'
import { useToast } from '@/context/ToastContext'
import { useAsyncAction } from '@/hooks/useAsyncAction'
import { uploadPhoto } from '@/utils/imageUpload'
import { formatDate, timeAgo } from '@/utils/helpers'
import { CATEGORIES } from '@/components/complaints/AddComplaintModal'
import Sheet from '@/components/resident/Sheet'
import Spinner from '@/components/ui/Spinner'
import FormError from '@/components/ui/FormError'

const inputCls = 'w-full border border-slate-200 rounded-xl px-3 py-2.5 text-base text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500'
const CATEGORY = Object.fromEntries(CATEGORIES.map(c => [c.value, c.label]))
const DAY = 86400000

function status(c) {
  if (c.withdrawnAt) return ['Withdrawn', 'bg-slate-100 text-slate-500']
  if (c.status === 'resolved') return c.closedAt ? ['Closed', 'bg-slate-100 text-slate-600'] : ['Fixed — please confirm', 'bg-emerald-50 text-emerald-700']
  if (c.status === 'in-progress') return ['In progress', 'bg-indigo-50 text-indigo-700']
  return ['Open', 'bg-amber-50 text-amber-700']
}

function NewComplaint({ onDone, onCancel }) {
  const { client } = useResident()
  const [form, setForm] = useState({ category: 'plumbing', description: '', urgent: false, okToEnter: true })
  const [photos, setPhotos] = useState([])
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const { run, busy, error } = useAsyncAction(async () => {
    const photoIds = []
    for (const p of photos) photoIds.push(await uploadPhoto(client, p))
    await client.post('/resident/complaints', { ...form, photoIds })
    onDone()
  })
  return (
    <form onSubmit={e => { e.preventDefault(); run() }} className="space-y-4">
      <div>
        <label htmlFor="rc-cat" className="block text-slate-700 text-sm font-medium mb-1.5">What is it about?</label>
        <select id="rc-cat" value={form.category} onChange={e => set('category', e.target.value)} className={inputCls}>
          {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="rc-desc" className="block text-slate-700 text-sm font-medium mb-1.5">Describe the problem</label>
        <textarea id="rc-desc" required minLength={5} maxLength={2000} rows={4} value={form.description} onChange={e => set('description', e.target.value)} placeholder="e.g. Bathroom tap leaking since morning" className={`${inputCls} resize-none`} />
      </div>
      <div>
        <p className="block text-slate-700 text-sm font-medium mb-1.5">Photos <span className="text-slate-400 font-normal">(up to 3)</span></p>
        <div className="flex flex-wrap gap-2">
          {photos.map((p, i) => (
            <span key={i} className="flex items-center gap-1 text-xs bg-slate-100 rounded-lg px-2 py-1"><Camera size={12} /> Photo {i + 1}<button type="button" onClick={() => setPhotos(list => list.filter((_, j) => j !== i))} aria-label="Remove photo"><X size={12} /></button></span>
          ))}
          {photos.length < 3 && (
            <label className="flex items-center gap-1 text-xs font-medium text-indigo-600 border border-dashed border-indigo-300 rounded-lg px-2.5 py-1 cursor-pointer">
              <Plus size={12} /> Add photo
              <input type="file" accept="image/*" className="sr-only" onChange={e => { const f = e.target.files?.[0]; if (f) setPhotos(list => [...list, f]); e.target.value = '' }} />
            </label>
          )}
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={form.urgent} onChange={e => set('urgent', e.target.checked)} className="accent-indigo-600 w-4 h-4" /> Urgent (no water, no power, safety)</label>
      <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={form.okToEnter} onChange={e => set('okToEnter', e.target.checked)} className="accent-indigo-600 w-4 h-4" /> OK to enter my room if I&apos;m out</label>
      <FormError message={error} />
      <div className="flex gap-3">
        <button type="button" onClick={onCancel} disabled={busy} className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium disabled:opacity-50">Cancel</button>
        <button type="submit" disabled={busy} className="flex-1 py-3 rounded-xl bg-indigo-600 text-white text-sm font-semibold disabled:opacity-60">{busy ? 'Sending…' : 'Send'}</button>
      </div>
    </form>
  )
}

export default function TenantComplaints() {
  const { client, tenancyId, tenancies } = useResident()
  const { showToast } = useToast()
  const [list, setList] = useState(null)
  const [error, setError] = useState('')
  const [adding, setAdding] = useState(false)
  const full = tenancies.find(t => t.id === tenancyId)?.access === 'full'

  const load = useCallback(() => client.get('/resident/complaints').then(setList).catch(e => setError(e.message)), [client])
  useEffect(() => { setList(null); load() }, [load, tenancyId])

  async function act(c, action) {
    try {
      await client.post(`/resident/complaints/${c.id}`, { action })
      showToast(action === 'confirm' ? 'Thanks for confirming!' : action === 'reopen' ? 'Reopened — your PG has been told.' : 'Withdrawn.')
      load()
    } catch (e) {
      showToast(e.message, 'error')
    }
  }

  if (error) return <FormError message={error} />
  if (!list) return <div className="flex justify-center py-20"><Spinner size={26} /></div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-slate-900">Complaints</h1>
        {full && <button onClick={() => setAdding(true)} className="flex items-center gap-1 text-sm font-semibold text-white bg-indigo-600 px-3 py-1.5 rounded-lg"><Plus size={15} /> New</button>}
      </div>
      {list.length === 0 && <p className="text-sm text-slate-400 text-center py-10">No complaints yet. Something broken? Tap New.</p>}
      {list.map(c => {
        const [label, cls] = status(c)
        const canReopen = c.status === 'resolved' && !c.withdrawnAt && c.resolvedAt && Date.now() - new Date(c.resolvedAt).getTime() < 7 * DAY
        return (
          <section key={c.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-slate-500">{CATEGORY[c.category] ?? c.category}{c.priority === 'high' ? ' · urgent' : ''}</span>
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${cls}`}>{label}</span>
            </div>
            <p className="text-sm text-slate-800 mt-1.5 whitespace-pre-wrap">{c.description}</p>
            {c.photoIds.length > 0 && (
              <div className="flex gap-2 mt-2">
                {c.photoIds.map(id => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <a key={id} href={`/api/files/${id}`} target="_blank" rel="noopener noreferrer"><img src={`/api/files/${id}`} alt="Complaint photo" className="w-14 h-14 rounded-lg object-cover border border-slate-200" /></a>
                ))}
              </div>
            )}
            {c.update && <p className="text-xs text-slate-600 bg-slate-50 rounded-lg px-3 py-2 mt-2">PG: {c.update}</p>}
            <p className="text-[11px] text-slate-400 mt-2">Raised {timeAgo(c.createdAt)}{c.resolvedAt && !c.withdrawnAt ? ` · fixed ${formatDate(String(c.resolvedAt).slice(0, 10))}` : ''}</p>
            {full && (
              <div className="flex gap-2 mt-3">
                {c.status === 'resolved' && !c.closedAt && <button onClick={() => act(c, 'confirm')} className="flex-1 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold">Yes, it&apos;s fixed</button>}
                {canReopen && <button onClick={() => act(c, 'reopen')} className="flex-1 py-2 rounded-lg border border-slate-200 text-slate-700 text-xs font-semibold">Not fixed — reopen</button>}
                {c.status === 'open' && !c.withdrawnAt && <button onClick={() => act(c, 'withdraw')} className="py-2 px-3 rounded-lg text-slate-500 text-xs">Withdraw</button>}
              </div>
            )}
          </section>
        )
      })}
      <Sheet open={adding} title="New complaint" onClose={() => setAdding(false)}>
        <NewComplaint onCancel={() => setAdding(false)} onDone={() => { setAdding(false); showToast('Sent to your PG.'); load() }} />
      </Sheet>
    </div>
  )
}
