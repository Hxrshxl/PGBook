'use client'
import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import Badge from '../ui/Badge'
import { timeAgo, initials, formatDate } from '@/utils/helpers'
import { useAsyncAction } from '@/hooks/useAsyncAction'
import { CATEGORIES } from './AddComplaintModal'

const CATEGORY_LABELS = Object.fromEntries(CATEGORIES.map(c => [c.value, c.label]))

// onUpdate(id, updates) and onDelete(complaint) may be async and should throw on failure.
export default function ComplaintCard({ complaint, onUpdate, onDelete }) {
  const [editingNotes, setEditingNotes] = useState(false)
  const [notes, setNotes] = useState(complaint.ownerNotes ?? '')
  const { run, busy, error } = useAsyncAction(onUpdate)

  async function saveNotes() {
    const result = await run(complaint.id, { ownerNotes: notes })
    if (result) setEditingNotes(false)
  }

  const action = 'text-xs font-medium border px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60'

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-xs font-bold shrink-0">
            {initials(complaint.tenantName)}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-slate-900 truncate">{complaint.tenantName}</p>
            <p className="text-slate-400 text-xs">Room {complaint.room} · {timeAgo(complaint.createdAt)}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Badge status={complaint.priority} />
          <Badge status={complaint.status} />
        </div>
      </div>

      <div>
        <div className="flex flex-wrap gap-1.5 mb-2">
          <span className="inline-block text-xs font-medium px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">
            {CATEGORY_LABELS[complaint.category] ?? complaint.category}
          </span>
          {complaint.source === 'resident' && <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700">From tenant app</span>}
          {complaint.okToEnter && <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700">OK to enter room</span>}
          {complaint.reopenCount > 0 && <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-amber-50 text-amber-700">Reopened {complaint.reopenCount}×</span>}
        </div>
        <p className="text-slate-700 text-sm leading-relaxed whitespace-pre-wrap break-words">{complaint.description}</p>
        {complaint.photoIds?.length > 0 && (
          <div className="flex gap-2 mt-3">
            {complaint.photoIds.map(id => (
              <a key={id} href={`/api/files/${id}`} target="_blank" rel="noopener noreferrer" className="block w-16 h-16 rounded-lg overflow-hidden border border-slate-200 hover:border-indigo-400">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/files/${id}`} alt="Complaint photo" className="w-full h-full object-cover" loading="lazy" />
              </a>
            ))}
          </div>
        )}
        {complaint.withdrawnAt
          ? <p className="text-xs text-slate-500 mt-2">Withdrawn by the tenant {formatDate(complaint.withdrawnAt)}</p>
          : complaint.resolvedAt && <p className="text-xs text-emerald-600 mt-2">Resolved {formatDate(complaint.resolvedAt)}{complaint.closedBy === 'resident' ? ' · tenant confirmed it is fixed' : complaint.closedBy === 'auto' ? ' · closed automatically' : complaint.source === 'resident' ? ' · waiting for the tenant to confirm' : ''}</p>}
      </div>

      {editingNotes ? (
        <div>
          <textarea
            rows={2}
            maxLength={1000}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder={complaint.source === 'resident' ? 'Update for the tenant (they see it in the app)…' : 'Add notes…'}
            aria-label="Owner notes"
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition-colors resize-none"
            autoFocus
          />
          <div className="flex gap-2 mt-2">
            <button onClick={saveNotes} disabled={busy} className="text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60">{busy ? 'Saving…' : 'Save'}</button>
            <button onClick={() => { setNotes(complaint.ownerNotes ?? ''); setEditingNotes(false) }} className="text-xs text-slate-500 hover:text-slate-700 px-2 py-1.5">Cancel</button>
          </div>
        </div>
      ) : (
        <div className="text-xs text-slate-400">
          {complaint.ownerNotes && <p className="italic text-slate-500 whitespace-pre-wrap">&ldquo;{complaint.ownerNotes}&rdquo;</p>}
          <button onClick={() => setEditingNotes(true)} className="mt-1 text-indigo-500 hover:text-indigo-700 font-medium transition-colors">
            {complaint.ownerNotes ? 'Edit notes' : '+ Add notes'}
          </button>
        </div>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex items-center gap-2 pt-1 border-t border-slate-50">
        {complaint.status === 'open' && (
          <button disabled={busy} onClick={() => run(complaint.id, { status: 'in-progress' })} className={`${action} text-blue-700 bg-blue-50 hover:bg-blue-100 border-blue-200`}>
            Mark In Progress
          </button>
        )}
        {complaint.status !== 'resolved' && (
          <button disabled={busy} onClick={() => run(complaint.id, { status: 'resolved' })} className={`${action} text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border-emerald-200`}>
            Mark Resolved
          </button>
        )}
        {complaint.status === 'resolved' && (
          <button disabled={busy} onClick={() => run(complaint.id, { status: 'open' })} className={`${action} text-amber-700 bg-amber-50 hover:bg-amber-100 border-amber-200`}>
            Re-open
          </button>
        )}
        <button onClick={() => onDelete(complaint)} aria-label="Delete complaint" className="ml-auto text-slate-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 transition-colors">
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  )
}
