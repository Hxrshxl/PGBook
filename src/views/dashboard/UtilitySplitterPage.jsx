'use client'
import { useState } from 'react'
import { Plus, Zap } from 'lucide-react'
import { useAppData } from '@/context/AppContext'
import { useToast } from '@/context/ToastContext'
import { getCurrentMonth, formatCurrency, formatMonth, getActiveTenants } from '@/utils/helpers'
import MonthSelector from '@/components/ui/MonthSelector'
import Modal from '@/components/ui/Modal'
import EmptyState from '@/components/ui/EmptyState'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import AddBillModal, { BILL_TYPES } from '@/components/utilities/AddBillModal'
import PageHeader from '@/components/ui/PageHeader'
import StatStrip from '@/components/ui/StatStrip'
import RowMenu from '@/components/ui/RowMenu'
import { btn, page } from '@/components/ui/styles'

const TYPE_LABELS = Object.fromEntries(BILL_TYPES.map(t => [t.value, t.label]))

export default function UtilitySplitterPage() {
  const { tenants, utilityBills, properties, selectedPropertyId, addUtilityBill, deleteUtilityBill } = useAppData()
  const { showToast } = useToast()
  const [month, setMonth] = useState(getCurrentMonth)
  const [addOpen, setAddOpen] = useState(false)
  const [deleting, setDeleting] = useState(null)

  const tenantName = id => tenants.find(t => t.id === id)?.name ?? 'Deleted tenant'
  const activeTenants = getActiveTenants(tenants)
  const monthBills = utilityBills.filter(b => b.month === month)
  const totalForMonth = monthBills.reduce((s, b) => s + b.totalAmount, 0)

  async function handleAdd(data) {
    await addUtilityBill(data)
    setAddOpen(false)
    if (data.month !== month) setMonth(data.month)
    showToast(`${TYPE_LABELS[data.type] ?? 'Bill'} of ${formatCurrency(data.totalAmount)} split across ${data.tenantIds.length} tenant(s).`)
  }

  async function handleDelete() {
    await deleteUtilityBill(deleting.id)
    showToast('Bill deleted and removed from tenant dues.', 'warning')
    setDeleting(null)
  }

  return (
    <div className={`${page} mx-auto max-w-4xl`}>
      <PageHeader
        title="Utility bills"
        description="Split electricity, water and other bills across tenants. Each share is added to their rent."
        actions={<>
          <MonthSelector value={month} onChange={setMonth} />
          <button onClick={() => setAddOpen(true)} className={btn.primary}><Plus size={15} /> Add bill</button>
        </>}
      />

      {monthBills.length === 0 ? (
        <EmptyState icon={Zap} title="No bills for this month"
          message={`Add a utility bill to split it across ${activeTenants.length} current tenant${activeTenants.length === 1 ? '' : 's'}.`}
          actionLabel="Add bill" onAction={() => setAddOpen(true)} />
      ) : (
        <>
          <StatStrip className="mb-6" items={[
            { label: 'Bills', value: monthBills.length, sub: formatMonth(month) },
            { label: 'Total split', value: formatCurrency(totalForMonth) },
            { label: 'Current tenants', value: activeTenants.length },
          ]} />

          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
            {monthBills.map(bill => (
              <li key={bill.id} className="flex items-start gap-4 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="font-medium text-slate-900">{TYPE_LABELS[bill.type] ?? 'Other'}</p>
                    <p className="font-medium tabular-nums text-slate-900">{formatCurrency(bill.totalAmount)}</p>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">
                    About {formatCurrency(bill.perTenantAmount)} × {bill.tenantCount} tenant{bill.tenantCount === 1 ? '' : 's'}
                    {bill.note && ` · ${bill.note}`}
                  </p>
                  {bill.allocations?.length > 0 && (
                    <p className="mt-2 text-xs leading-relaxed text-slate-600">
                      {bill.allocations.map(a => `${tenantName(a.tenantId)} ${formatCurrency(a.amount)}`).join(' · ')}
                    </p>
                  )}
                </div>
                <RowMenu label="Bill actions" items={[{ label: 'Delete bill', onClick: () => setDeleting(bill), danger: true }]} />
              </li>
            ))}
          </ul>
          <p className="pt-3 text-center text-xs text-slate-500">Deleting a bill removes its shares from every tenant&apos;s dues.</p>
        </>
      )}

      <Modal isOpen={addOpen} onClose={() => setAddOpen(false)} title="Add utility bill" maxWidth="max-w-lg">
        <AddBillModal tenants={tenants} properties={properties} defaultPropertyId={selectedPropertyId !== 'all' ? selectedPropertyId : undefined} defaultMonth={month} onSubmit={handleAdd} onClose={() => setAddOpen(false)} />
      </Modal>

      <ConfirmDialog
        isOpen={!!deleting}
        title="Delete this bill?"
        message={deleting && <>The {formatCurrency(deleting.totalAmount)} {TYPE_LABELS[deleting.type]?.toLowerCase()} bill for {formatMonth(deleting.month)} will be removed from every tenant&apos;s dues.</>}
        confirmLabel="Delete bill"
        onConfirm={handleDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  )
}
