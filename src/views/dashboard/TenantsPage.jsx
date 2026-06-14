'use client'
import { useState, useMemo } from 'react'
import { Plus, Search, Users } from 'lucide-react'
import { useAppData } from '@/context/AppContext'
import { useToast } from '@/context/ToastContext'
import Modal from '@/components/ui/Modal'
import EmptyState from '@/components/ui/EmptyState'
import TenantForm from '@/components/tenants/TenantForm'
import TenantCard from '@/components/tenants/TenantCard'
import DeleteConfirmDialog from '@/components/tenants/DeleteConfirmDialog'

const TABS = [
  { key: 'active',  label: 'Active'  },
  { key: 'vacated', label: 'Vacated' },
  { key: 'all',     label: 'All'     },
]

export default function TenantsPage() {
  const { tenants, addTenant, updateTenant, vacateTenant } = useAppData()
  const { showToast } = useToast()
  const [tab, setTab] = useState('active')
  const [search, setSearch] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [editingTenant, setEditingTenant] = useState(null)
  const [deletingTenant, setDeletingTenant] = useState(null)

  const counts = {
    active:  tenants.filter(t => t.status === 'active').length,
    vacated: tenants.filter(t => t.status === 'vacated').length,
    all:     tenants.length,
  }

  const filtered = useMemo(() => {
    return tenants
      .filter(t => tab === 'all' || t.status === tab)
      .filter(t => {
        if (!search) return true
        const q = search.toLowerCase()
        return t.name.toLowerCase().includes(q) || t.room.toLowerCase().includes(q) || t.phone.includes(q)
      })
  }, [tenants, tab, search])

  async function handleAdd(formData) {
    try {
      const tenant = await addTenant(formData)
      setAddOpen(false)
      showToast(`${tenant.name} added successfully.`)
    } catch (err) {
      showToast(err.message ?? 'Failed to add tenant.', 'error')
    }
  }

  async function handleEdit(formData) {
    try {
      await updateTenant(editingTenant.id, formData)
      setEditingTenant(null)
      showToast('Tenant details updated.')
    } catch (err) {
      showToast(err.message ?? 'Failed to update tenant.', 'error')
    }
  }

  async function handleDelete() {
    const name = deletingTenant.name
    try {
      await vacateTenant(deletingTenant.id)
      setDeletingTenant(null)
      showToast(`${name} marked as vacated.`, 'warning')
    } catch (err) {
      showToast(err.message ?? 'Failed to update tenant.', 'error')
    }
  }

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Tenant Roster</h1>
          <p className="text-slate-500 text-sm mt-1">{counts.active} active · {counts.vacated} vacated</p>
        </div>
        <button onClick={() => setAddOpen(true)} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm px-4 py-2.5 rounded-xl transition-colors">
          <Plus size={16} /> Add Tenant
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === t.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              {t.label} <span className="ml-1 text-xs text-slate-400">({counts[t.key]})</span>
            </button>
          ))}
        </div>
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" placeholder="Search name, room, phone…" value={search} onChange={e => setSearch(e.target.value)}
            className="w-full sm:w-64 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition-colors" />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Users}
          title={search ? 'No tenants match your search' : `No ${tab === 'all' ? '' : tab} tenants`}
          message={search ? 'Try a different name, room, or phone.' : 'Add your first tenant to get started.'}
          actionLabel={!search ? 'Add Tenant' : undefined} onAction={() => setAddOpen(true)} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(t => (
            <TenantCard key={t.id} tenant={t} onEdit={setEditingTenant} onDelete={setDeletingTenant} />
          ))}
        </div>
      )}

      <Modal isOpen={addOpen} onClose={() => setAddOpen(false)} title="Add New Tenant" maxWidth="max-w-xl">
        <TenantForm onSubmit={handleAdd} onCancel={() => setAddOpen(false)} />
      </Modal>
      <Modal isOpen={!!editingTenant} onClose={() => setEditingTenant(null)} title="Edit Tenant" maxWidth="max-w-xl">
        {editingTenant && <TenantForm initialData={editingTenant} onSubmit={handleEdit} onCancel={() => setEditingTenant(null)} />}
      </Modal>
      <DeleteConfirmDialog tenant={deletingTenant} onConfirm={handleDelete} onCancel={() => setDeletingTenant(null)} />
    </div>
  )
}
