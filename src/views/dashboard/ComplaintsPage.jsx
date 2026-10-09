'use client'
import { useState } from 'react'
import { MessageSquare, Plus } from 'lucide-react'
import { useAppData } from '@/context/AppContext'
import { useToast } from '@/context/ToastContext'
import { getActiveTenants } from '@/utils/helpers'
import Modal from '@/components/ui/Modal'
import EmptyState from '@/components/ui/EmptyState'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import AddComplaintModal from '@/components/complaints/AddComplaintModal'
import ComplaintCard from '@/components/complaints/ComplaintCard'

const TABS = [
  { key: 'all',         label: 'All'         },
  { key: 'open',        label: 'Open'        },
  { key: 'in-progress', label: 'In Progress' },
  { key: 'resolved',    label: 'Resolved'    },
]

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 }
const STATUS_MESSAGES = { 'in-progress': 'Marked as in progress.', resolved: 'Complaint resolved.', open: 'Complaint re-opened.' }

export default function ComplaintsPage() {
  const { tenants, complaints, addComplaint, updateComplaint, deleteComplaint } = useAppData()
  const { showToast } = useToast()
  const [tab, setTab] = useState('all')
  const [addOpen, setAddOpen] = useState(false)
  const [deleting, setDeleting] = useState(null)

  const activeTenants = getActiveTenants(tenants)
  // Unresolved first, then by priority, then newest.
  const sorted = [...complaints].sort((a, b) =>
    (a.status === 'resolved') - (b.status === 'resolved')
    || PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
    || new Date(b.createdAt) - new Date(a.createdAt))
  const filtered = tab === 'all' ? sorted : sorted.filter(c => c.status === tab)
  const counts = {
    all:           complaints.length,
    open:          complaints.filter(c => c.status === 'open').length,
    'in-progress': complaints.filter(c => c.status === 'in-progress').length,
    resolved:      complaints.filter(c => c.status === 'resolved').length,
  }

  async function handleAdd(data) {
    await addComplaint(data)
    setAddOpen(false)
    showToast('Complaint logged successfully.')
  }

  async function handleUpdate(id, updates) {
    const complaint = await updateComplaint(id, updates)
    showToast(updates.status ? STATUS_MESSAGES[updates.status] : 'Notes saved.')
    return complaint
  }

  async function handleDelete() {
    await deleteComplaint(deleting.id)
    showToast('Complaint deleted.', 'warning')
    setDeleting(null)
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Complaint Portal</h1>
          <p className="text-slate-500 text-sm mt-1">Track and resolve maintenance issues from tenants</p>
        </div>
        <button onClick={() => setAddOpen(true)} className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm px-4 py-2.5 rounded-xl transition-colors shrink-0">
          <Plus size={16} /> Add Complaint
        </button>
      </div>

      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 mb-6 w-fit max-w-full overflow-x-auto">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${tab === t.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            {t.label}
            {counts[t.key] > 0 && (
              <span className={`ml-1.5 text-xs font-semibold px-1.5 py-0.5 rounded-full ${tab === t.key ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-500'}`}>
                {counts[t.key]}
              </span>
            )}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={MessageSquare}
          title={tab === 'all' ? 'No complaints yet' : `No ${tab === 'in-progress' ? 'in-progress' : tab} complaints`}
          message={tab === 'all' ? 'Log a new complaint to track and resolve maintenance issues.' : 'All caught up in this category.'}
          actionLabel={tab === 'all' ? 'Add Complaint' : undefined}
          onAction={tab === 'all' ? () => setAddOpen(true) : undefined} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map(c => <ComplaintCard key={c.id} complaint={c} onUpdate={handleUpdate} onDelete={setDeleting} />)}
        </div>
      )}

      <Modal isOpen={addOpen} onClose={() => setAddOpen(false)} title="Log New Complaint" maxWidth="max-w-md">
        {activeTenants.length === 0 ? (
          <div className="py-6 text-center text-slate-500 text-sm">No active tenants. Add tenants before logging complaints.</div>
        ) : (
          <AddComplaintModal tenants={activeTenants} onSubmit={handleAdd} onClose={() => setAddOpen(false)} />
        )}
      </Modal>

      <ConfirmDialog
        isOpen={!!deleting}
        title="Delete this complaint?"
        message="This removes it permanently, including your notes."
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  )
}
