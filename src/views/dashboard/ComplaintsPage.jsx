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
import PageHeader from '@/components/ui/PageHeader'
import Tabs from '@/components/ui/Tabs'
import { btn, page } from '@/components/ui/styles'

const TABS = [
  { key: 'all',         label: 'All'         },
  { key: 'open',        label: 'Open'        },
  { key: 'in-progress', label: 'In progress' },
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
    <div className={`${page} mx-auto max-w-4xl`}>
      <PageHeader
        title="Complaints"
        description="Maintenance issues from tenants, most urgent first."
        actions={<button onClick={() => setAddOpen(true)} className={btn.primary}><Plus size={15} /> Log complaint</button>}
      />

      <Tabs className="mb-4" value={tab} onChange={setTab} tabs={TABS.map(t => ({ ...t, count: counts[t.key] }))} />

      {filtered.length === 0 ? (
        <EmptyState icon={MessageSquare}
          title={tab === 'all' ? 'No complaints yet' : `No ${tab === 'in-progress' ? 'in-progress' : tab} complaints`}
          message={tab === 'all' ? 'Log a complaint to track and resolve maintenance issues.' : 'All caught up here.'}
          actionLabel={tab === 'all' ? 'Log complaint' : undefined}
          onAction={tab === 'all' ? () => setAddOpen(true) : undefined} />
      ) : (
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
          {filtered.map(c => <li key={c.id}><ComplaintCard complaint={c} onUpdate={handleUpdate} onDelete={setDeleting} /></li>)}
        </ul>
      )}

      <Modal isOpen={addOpen} onClose={() => setAddOpen(false)} title="Log complaint" maxWidth="max-w-md">
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
