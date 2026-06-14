'use client'
import { useState } from 'react'
import Badge from '../ui/Badge'
import { timeAgo, initials } from '../../utils/helpers'
import { User } from 'lucide-react'

const CATEGORY_LABELS = {
  plumbing:    'Plumbing',
  electrical:  'Electrical',
  wifi:        'WiFi / Internet',
  furniture:   'Furniture',
  cleaning:    'Cleaning',
  security:    'Security',
  noise:       'Noise',
  other:       'Other',
}

export default function ComplaintCard({ complaint, onUpdateStatus }) {
  const [editingNotes, setEditingNotes] = useState(false)
  const [notes, setNotes] = useState(complaint.ownerNotes ?? '')

  function saveNotes() {
    onUpdateStatus(complaint.id, complaint.status, notes)
    setEditingNotes(false)
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex flex-col gap-4">
      {/* Top row */}
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

      {/* Category chip + Description */}
      <div>
        <span className="inline-block text-xs font-medium px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 mb-2">
          {CATEGORY_LABELS[complaint.category] ?? complaint.category}
        </span>
        <p className="text-slate-700 text-sm leading-relaxed">{complaint.description}</p>
      </div>

      {/* Owner notes */}
      {editingNotes ? (
        <div>
          <textarea
            rows={2}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Add internal notes…"
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition-colors resize-none"
            autoFocus
          />
          <div className="flex gap-2 mt-2">
            <button onClick={saveNotes} className="text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 rounded-lg transition-colors">Save</button>
            <button onClick={() => { setNotes(complaint.ownerNotes ?? ''); setEditingNotes(false) }} className="text-xs text-slate-500 hover:text-slate-700 px-2 py-1.5">Cancel</button>
          </div>
        </div>
      ) : (
        <div className="text-xs text-slate-400">
          {complaint.ownerNotes
            ? <p className="italic text-slate-500">"{complaint.ownerNotes}"</p>
            : null}
          <button
            onClick={() => setEditingNotes(true)}
            className="mt-1 text-indigo-500 hover:text-indigo-700 font-medium transition-colors"
          >
            {complaint.ownerNotes ? 'Edit notes' : '+ Add notes'}
          </button>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-2 pt-1 border-t border-slate-50">
        {complaint.status === 'open' && (
          <button
            onClick={() => onUpdateStatus(complaint.id, 'in-progress', complaint.ownerNotes)}
            className="text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-3 py-1.5 rounded-lg transition-colors"
          >
            Mark In Progress
          </button>
        )}
        {(complaint.status === 'open' || complaint.status === 'in-progress') && (
          <button
            onClick={() => onUpdateStatus(complaint.id, 'resolved', complaint.ownerNotes)}
            className="text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3 py-1.5 rounded-lg transition-colors"
          >
            Mark Resolved
          </button>
        )}
        {complaint.status === 'resolved' && (
          <button
            onClick={() => onUpdateStatus(complaint.id, 'open', complaint.ownerNotes)}
            className="text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-3 py-1.5 rounded-lg transition-colors"
          >
            Re-open
          </button>
        )}
      </div>
    </div>
  )
}
