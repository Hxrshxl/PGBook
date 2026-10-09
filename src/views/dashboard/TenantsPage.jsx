'use client'
import { useState, useMemo } from 'react'
import { Plus, Search, Users } from 'lucide-react'
import { useAppData } from '@/context/AppContext'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { todayISO, toWhatsAppNumber } from '@/utils/helpers'
import { api } from '@/utils/api'
import Modal from '@/components/ui/Modal'
import EmptyState from '@/components/ui/EmptyState'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import TenantForm from '@/components/tenants/TenantForm'
import TenantCard from '@/components/tenants/TenantCard'

const TABS = [
  { key: 'active',  label: 'Active'  },
  { key: 'vacated', label: 'Vacated' },
  { key: 'all',     label: 'All'     },
]

export default function TenantsPage() {
  const { tenants, properties, currentProperty, propertyById, addTenant, updateTenant, vacateTenant, reactivateTenant, deleteTenant } = useAppData()
  const { can } = useAuth()
  const canManage = can('tenants.manage')
  const showProperty = !currentProperty && properties.length > 1
  const { showToast } = useToast()
  const [tab, setTab] = useState('active')
  const [search, setSearch] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [editingTenant, setEditingTenant] = useState(null)
  const [vacating, setVacating] = useState(null)
  const [moveOutDate, setMoveOutDate] = useState(todayISO())
  const [restoring, setRestoring] = useState(null)
  const [deleting, setDeleting] = useState(null)

  const counts = {
    active:  tenants.filter(t => t.status === 'active').length,
    vacated: tenants.filter(t => t.status === 'vacated').length,
    all:     tenants.length,
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const digits = q.replace(/\D/g, '')
    return tenants
      .filter(t => tab === 'all' || t.status === tab)
      .filter(t => {
        if (!q) return true
        return t.name.toLowerCase().includes(q)
          || t.room.toLowerCase().includes(q)
          || (digits.length >= 3 && t.phone.replace(/\D/g, '').includes(digits))
      })
      .sort((a, b) => a.room.localeCompare(b.room, undefined, { numeric: true }))
  }, [tenants, tab, search])

  async function handleInvite(tenant) {
    try {
      const { message } = await api.post(`/tenants/${tenant.id}/invite`)
      window.open(`https://wa.me/${toWhatsAppNumber(tenant.phone)}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer')
      showToast(`Opening WhatsApp to invite ${tenant.name}…`, 'info')
    } catch (err) {
      showToast(err.message, 'error')
    }
  }

  async function handleAdd(formData) {
    const tenant = await addTenant(formData)
    setAddOpen(false)
    showToast(`${tenant.name} added successfully.`)
  }

  async function handleEdit(formData) {
    await updateTenant(editingTenant.id, formData)
    setEditingTenant(null)
    showToast('Tenant details updated.')
  }

  function openVacate(tenant) {
    setMoveOutDate(todayISO())
    setVacating(tenant)
  }

  async function handleVacate() {
    await vacateTenant(vacating.id, moveOutDate)
    showToast(`${vacating.name} marked as vacated.`, 'warning')
    setVacating(null)
  }

  async function handleRestore() {
    await reactivateTenant(restoring.id)
    showToast(`${restoring.name} is active again.`)
    setRestoring(null)
  }

  async function handleDelete() {
    await deleteTenant(deleting.id)
    showToast(`${deleting.name} and their records were deleted.`, 'warning')
    setDeleting(null)
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Tenant Roster</h1>
          <p className="text-slate-500 text-sm mt-1">{counts.active} active · {counts.vacated} vacated</p>
        </div>
        {canManage && (
          <button onClick={() => setAddOpen(true)} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm px-4 py-2.5 rounded-xl transition-colors shrink-0">
            <Plus size={16} /> <span className="hidden sm:inline">Add Tenant</span><span className="sm:hidden">Add</span>
          </button>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === t.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              {t.label} <span className="ml-1 text-xs text-slate-400">({counts[t.key]})</span>
            </button>
          ))}
        </div>
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="search" aria-label="Search tenants" placeholder="Search name, room, phone…" value={search} onChange={e => setSearch(e.target.value)}
            className="w-full sm:w-64 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition-colors" />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Users}
          title={search ? 'No tenants match your search' : tab === 'all' ? 'No tenants yet' : `No ${tab} tenants`}
          message={search ? 'Try a different name, room, or phone.' : tab === 'vacated' ? 'Tenants you mark as vacated appear here.' : 'Add your first tenant to get started.'}
          actionLabel={canManage && !search && tab !== 'vacated' ? 'Add Tenant' : undefined} onAction={() => setAddOpen(true)} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(t => (
            <TenantCard key={t.id} tenant={t} propertyName={showProperty ? propertyById.get(t.propertyId)?.name : null}
              onEdit={canManage ? setEditingTenant : null} onVacate={canManage ? openVacate : null}
              onReactivate={canManage ? setRestoring : null} onDelete={can('tenants.delete') ? setDeleting : null}
              onInvite={canManage ? handleInvite : null} />
          ))}
        </div>
      )}

      <Modal isOpen={addOpen} onClose={() => setAddOpen(false)} title="Add New Tenant" maxWidth="max-w-2xl">
        <TenantForm onSubmit={handleAdd} onCancel={() => setAddOpen(false)} />
      </Modal>
      <Modal isOpen={!!editingTenant} onClose={() => setEditingTenant(null)} title="Edit Tenant" maxWidth="max-w-2xl">
        {editingTenant && <TenantForm initialData={editingTenant} onSubmit={handleEdit} onCancel={() => setEditingTenant(null)} />}
      </Modal>

      <ConfirmDialog
        isOpen={!!vacating}
        title={`Vacate ${vacating?.name ?? ''}?`}
        message={<>They will move to the Vacated list. Their payment history and any unpaid dues are kept.</>}
        confirmLabel="Mark as vacated"
        onConfirm={handleVacate}
        onCancel={() => setVacating(null)}
      >
        <label htmlFor="move-out" className="block text-slate-700 text-sm font-medium mb-1.5">Move-out date</label>
        <input id="move-out" type="date" value={moveOutDate} min={vacating?.moveInDate || undefined} onChange={e => setMoveOutDate(e.target.value)}
          className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-indigo-500" />
      </ConfirmDialog>

      <ConfirmDialog
        isOpen={!!restoring}
        tone="primary"
        title={`Restore ${restoring?.name ?? ''}?`}
        message="They will be marked active again and included in rent tracking."
        confirmLabel="Restore tenant"
        onConfirm={handleRestore}
        onCancel={() => setRestoring(null)}
      />

      <ConfirmDialog
        isOpen={!!deleting}
        title={`Permanently delete ${deleting?.name ?? ''}?`}
        message={<>This deletes the tenant <strong>and all their payment and complaint records</strong>. This cannot be undone.</>}
        confirmLabel="Delete forever"
        onConfirm={handleDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  )
}
