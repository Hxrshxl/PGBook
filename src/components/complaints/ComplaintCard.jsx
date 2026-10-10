'use client'
import { useState } from 'react'
import Badge from '../ui/Badge'
import RowMenu from '../ui/RowMenu'
import { button, field } from '../ui/styles'
import { timeAgo, formatDate } from '@/utils/helpers'
import { useAsyncAction } from '@/hooks/useAsyncAction'
import { CATEGORIES } from './AddComplaintModal'

const CATEGORY_LABELS = Object.fromEntries(CATEGORIES.map(c => [c.value, c.label]))
const PRIORITY = { high: ['High priority', 'red'], medium: ['Medium', 'amber'], low: ['Low', 'gray'] }

// One complaint as a row in the complaints list.
// onUpdate(id, updates) and onDelete(complaint) may be async and should throw on failure.
export default function ComplaintCard({ complaint, onUpdate, onDelete }) {
  const [editingNotes, setEditingNotes] = useState(false)
  const [notes, setNotes] = useState(complaint.ownerNotes ?? '')
  const { run, busy, error } = useAsyncAction(onUpdate)

  async function saveNotes() {
    const result = await run(complaint.id, { ownerNotes: notes })
    if (result) setEditingNotes(false)
  }

  const [priorityLabel, priorityTone] = PRIORITY[complaint.priority] ?? PRIORITY.low
  const meta = [
    complaint.tenantName,
    `Room ${complaint.room}`,
    timeAgo(complaint.createdAt),
    complaint.source === 'resident' && 'from the tenant app',
    complaint.okToEnter && 'OK to enter the room',
    complaint.reopenCount > 0 && `reopened ${complaint.reopenCount}×`,
  ].filter(Boolean)

  return (
    <div className="flex gap-4 px-5 py-4">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium text-slate-900">{CATEGORY_LABELS[complaint.category] ?? complaint.category}</p>
          <Badge status={complaint.status} />
          {complaint.status !== 'resolved' && <Badge tone={priorityTone}>{priorityLabel}</Badge>}
        </div>
        <p className="mt-0.5 text-xs text-slate-500">{meta.join(' · ')}</p>
        <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-700">{complaint.description}</p>

        {complaint.photoIds?.length > 0 && (
          <div className="mt-3 flex gap-2">
            {complaint.photoIds.map(id => (
              <a key={id} href={`/api/files/${id}`} target="_blank" rel="noopener noreferrer" className="block h-14 w-14 overflow-hidden rounded-md border border-slate-200 hover:border-slate-400">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/files/${id}`} alt="Complaint photo" className="h-full w-full object-cover" loading="lazy" />
              </a>
            ))}
          </div>
        )}

        {complaint.withdrawnAt
          ? <p className="mt-2 text-xs text-slate-500">Withdrawn by the tenant {formatDate(complaint.withdrawnAt)}</p>
          : complaint.resolvedAt && <p className="mt-2 text-xs text-slate-500">Resolved {formatDate(complaint.resolvedAt)}{complaint.closedBy === 'resident' ? ' · tenant confirmed it is fixed' : complaint.closedBy === 'auto' ? ' · closed automatically' : complaint.source === 'resident' ? ' · waiting for the tenant to confirm' : ''}</p>}

        {editingNotes ? (
          <div className="mt-3">
            <textarea
              rows={2}
              maxLength={1000}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder={complaint.source === 'resident' ? 'Update for the tenant (they see it in the app)…' : 'Add a note…'}
              aria-label="Owner notes"
              className={field.textarea}
              autoFocus
            />
            <div className="mt-2 flex gap-2">
              <button onClick={saveNotes} disabled={busy} className={button('primary', 'sm')}>{busy ? 'Saving…' : 'Save note'}</button>
              <button onClick={() => { setNotes(complaint.ownerNotes ?? ''); setEditingNotes(false) }} className={button('ghost', 'sm')}>Cancel</button>
            </div>
          </div>
        ) : complaint.ownerNotes ? (
          <button onClick={() => setEditingNotes(true)} className="mt-3 block w-full border-l-2 border-slate-200 pl-3 text-left text-xs text-slate-600 hover:border-slate-400" title="Edit note">
            <span className="font-medium text-slate-700">Your note: </span><span className="whitespace-pre-wrap">{complaint.ownerNotes}</span>
          </button>
        ) : null}

        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {complaint.status === 'open' && (
            <button disabled={busy} onClick={() => run(complaint.id, { status: 'in-progress' })} className={button('secondary', 'xs')}>Start work</button>
          )}
          {complaint.status !== 'resolved' && (
            <button disabled={busy} onClick={() => run(complaint.id, { status: 'resolved' })} className={button('secondary', 'xs')}>Mark resolved</button>
          )}
          {complaint.status === 'resolved' && (
            <button disabled={busy} onClick={() => run(complaint.id, { status: 'open' })} className={button('secondary', 'xs')}>Re-open</button>
          )}
          {!editingNotes && !complaint.ownerNotes && (
            <button onClick={() => setEditingNotes(true)} className={button('ghost', 'xs')}>Add note</button>
          )}
        </div>
      </div>
      <div className="shrink-0">
        <RowMenu label="More actions" items={[
          { label: complaint.ownerNotes ? 'Edit note' : 'Add note', onClick: () => setEditingNotes(true) },
          { divider: true },
          { label: 'Delete complaint', onClick: () => onDelete(complaint), danger: true },
        ]} />
      </div>
    </div>
  )
}
