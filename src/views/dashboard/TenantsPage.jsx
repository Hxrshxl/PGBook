'use client'
import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Plus, Users, Smartphone } from 'lucide-react'
import { useAppData } from '@/context/AppContext'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { chargesTotal, formatCurrency, formatDate, todayISO, toWhatsAppNumber } from '@/utils/helpers'
import { api } from '@/utils/api'
import Modal from '@/components/ui/Modal'
import EmptyState from '@/components/ui/EmptyState'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import TenantForm from '@/components/tenants/TenantForm'
import Badge from '@/components/ui/Badge'
import PageHeader from '@/components/ui/PageHeader'
import Tabs from '@/components/ui/Tabs'
import SearchInput from '@/components/ui/SearchInput'
import RowMenu from '@/components/ui/RowMenu'
import { btn, field, page } from '@/components/ui/styles'

const TABS = [
  { key: 'active',  label: 'Current'   },
  { key: 'vacated', label: 'Moved out' },
  { key: 'all',     label: 'All'       },
]

function StatusCell({ t }) {
  if (t.status !== 'active') return <Badge status="vacated">Moved out</Badge>
  if (t.noticeGivenAt) return <Badge tone="amber">On notice{t.expectedMoveOut ? ` · ${formatDate(t.expectedMoveOut)}` : ''}</Badge>
  return <Badge status="active" />
}

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
    showToast(`${vacating.name} marked as moved out.`, 'warning')
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

  const menuFor = t => [
    { label: 'Payment history', href: `/dashboard/history?tenantId=${t.id}` },
    { label: 'Edit details', onClick: () => setEditingTenant(t), hidden: !canManage },
    { label: t.portalInvitedAt ? 'Invite to app again' : 'Invite to tenant app', onClick: () => handleInvite(t), hidden: !canManage || t.status !== 'active' || !!t.residentId },
    { divider: true },
    { label: 'Mark as moved out', onClick: () => openVacate(t), hidden: !canManage || t.status !== 'active' },
    { label: 'Restore', onClick: () => setRestoring(t), hidden: !canManage || t.status === 'active' },
    { label: 'Delete permanently', onClick: () => setDeleting(t), danger: true, hidden: !can('tenants.delete') || t.status === 'active' },
  ]
  const monthly = t => t.rentAmount + chargesTotal(t.recurringCharges)

  return (
    <div className={`${page} mx-auto max-w-6xl`}>
      <PageHeader
        title="Tenants"
        description={`${counts.active} living here · ${counts.vacated} moved out`}
        actions={canManage && <button onClick={() => setAddOpen(true)} className={btn.primary}><Plus size={15} /> Add tenant</button>}
      />

      <div className="mb-4 flex flex-col-reverse gap-3 sm:flex-row sm:items-end sm:justify-between">
        <Tabs tabs={TABS.map(t => ({ ...t, count: counts[t.key] }))} value={tab} onChange={setTab} className="flex-1" />
        <SearchInput value={search} onChange={setSearch} placeholder="Search name, room or phone" label="Search tenants" />
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Users}
          title={search ? 'No tenants match your search' : tab === 'vacated' ? 'Nobody has moved out yet' : 'No tenants yet'}
          message={search ? 'Try a different name, room or phone number.' : tab === 'vacated' ? 'Tenants you mark as moved out appear here, with their history.' : 'Add your first tenant to start tracking rent.'}
          actionLabel={canManage && !search && tab !== 'vacated' ? 'Add tenant' : undefined} onAction={() => setAddOpen(true)} />
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white">
          <table className="hidden w-full text-sm md:table">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                <th scope="col" className="px-4 py-2.5 font-medium">Tenant</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Room</th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">Monthly</th>
                <th scope="col" className="hidden lg:table-cell px-3 py-2.5 text-right font-medium">Deposit</th>
                <th scope="col" className="hidden xl:table-cell px-3 py-2.5 font-medium">{tab === 'vacated' ? 'Stayed' : 'Since'}</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Status</th>
                <th scope="col" className="w-10 px-3 py-2.5"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(t => (
                <tr key={t.id} className="hover:bg-slate-50/70">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1.5 whitespace-nowrap">
                      <Link href={`/dashboard/history?tenantId=${t.id}`} className="font-medium text-slate-900 hover:underline">{t.name}</Link>
                      {t.residentId && <Smartphone size={12} className="text-slate-400" aria-label="Uses the tenant app" />}
                    </div>
                    <a href={`tel:${t.phone}`} className="text-xs text-slate-500 hover:text-slate-800">{t.phone}</a>
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <span className="text-slate-900">{t.room}</span>
                    {showProperty && <p className="max-w-[150px] truncate text-xs text-slate-500">{propertyById.get(t.propertyId)?.name}</p>}
                  </td>
                  <td className="px-3 py-2.5 text-right whitespace-nowrap">
                    <span className="text-slate-900">{formatCurrency(monthly(t))}</span>
                    {t.recurringCharges?.length > 0 && <p className="text-xs text-slate-500">incl. {t.recurringCharges.map(c => c.label.split(' ')[0].toLowerCase()).join(', ')}</p>}
                  </td>
                  <td className="hidden lg:table-cell px-3 py-2.5 text-right whitespace-nowrap text-slate-600">{t.depositAmount ? formatCurrency(t.depositAmount) : '—'}</td>
                  <td className="hidden xl:table-cell px-3 py-2.5 whitespace-nowrap text-slate-600">
                    {t.status === 'active' ? formatDate(t.moveInDate) : `${formatDate(t.moveInDate)} – ${formatDate(t.moveOutDate)}`}
                  </td>
                  <td className="px-3 py-2.5"><StatusCell t={t} /></td>
                  <td className="px-3 py-2.5 text-right"><RowMenu items={menuFor(t)} label={`Actions for ${t.name}`} /></td>
                </tr>
              ))}
            </tbody>
          </table>

          <ul className="divide-y divide-slate-100 md:hidden">
            {filtered.map(t => (
              <li key={t.id} className="flex items-start gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <Link href={`/dashboard/history?tenantId=${t.id}`} className="font-medium text-slate-900">{t.name}</Link>
                  <p className="text-xs text-slate-500">Room {t.room} · {formatCurrency(monthly(t))}/month</p>
                  {(t.status !== 'active' || t.noticeGivenAt) && <div className="mt-1.5"><StatusCell t={t} /></div>}
                </div>
                <RowMenu items={menuFor(t)} label={`Actions for ${t.name}`} />
              </li>
            ))}
          </ul>
        </div>
      )}

      <Modal isOpen={addOpen} onClose={() => setAddOpen(false)} title="Add tenant" maxWidth="max-w-2xl">
        <TenantForm onSubmit={handleAdd} onCancel={() => setAddOpen(false)} />
      </Modal>
      <Modal isOpen={!!editingTenant} onClose={() => setEditingTenant(null)} title="Edit tenant" maxWidth="max-w-2xl">
        {editingTenant && <TenantForm initialData={editingTenant} onSubmit={handleEdit} onCancel={() => setEditingTenant(null)} />}
      </Modal>

      <ConfirmDialog
        isOpen={!!vacating}
        title={`Mark ${vacating?.name ?? ''} as moved out?`}
        message="They move to the Moved out list. Their payment history and any unpaid dues are kept."
        confirmLabel="Mark as moved out"
        onConfirm={handleVacate}
        onCancel={() => setVacating(null)}
      >
        <label htmlFor="move-out" className={field.label}>Move-out date</label>
        <input id="move-out" type="date" value={moveOutDate} min={vacating?.moveInDate || undefined} onChange={e => setMoveOutDate(e.target.value)} className={field.input} />
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
