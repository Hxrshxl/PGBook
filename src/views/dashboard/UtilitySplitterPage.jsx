'use client'
import { useState } from 'react'
import { Plus, Zap, Trash2 } from 'lucide-react'
import { useAppData } from '@/context/AppContext'
import { useToast } from '@/context/ToastContext'
import { getCurrentMonth, formatCurrency, formatMonth, getActiveTenants } from '@/utils/helpers'
import MonthSelector from '@/components/ui/MonthSelector'
import Modal from '@/components/ui/Modal'
import EmptyState from '@/components/ui/EmptyState'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import AddBillModal, { BILL_TYPES } from '@/components/utilities/AddBillModal'

const TYPE_LABELS = Object.fromEntries(BILL_TYPES.map(t => [t.value, t.label]))
const TYPE_COLORS = {
  electricity: 'bg-amber-50 text-amber-700 border-amber-200',
  water:       'bg-blue-50 text-blue-700 border-blue-200',
  maintenance: 'bg-purple-50 text-purple-700 border-purple-200',
  internet:    'bg-teal-50 text-teal-700 border-teal-200',
  gas:         'bg-orange-50 text-orange-700 border-orange-200',
  other:       'bg-slate-50 text-slate-700 border-slate-200',
}

export default function UtilitySplitterPage() {
  const { tenants, utilityBills, addUtilityBill, deleteUtilityBill } = useAppData()
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
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Utility Bill Splitter</h1>
          <p className="text-slate-500 text-sm mt-1">Split electricity, water, and other bills across tenants</p>
        </div>
        <MonthSelector value={month} onChange={setMonth} />
      </div>

      {monthBills.length > 0 && (
        <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-6">
          {[
            { label: 'Bills this month', value: monthBills.length },
            { label: 'Total split', value: formatCurrency(totalForMonth) },
            { label: 'Active tenants', value: activeTenants.length },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
              <p className="text-xl sm:text-2xl font-bold text-slate-900 mb-0.5">{s.value}</p>
              <p className="text-slate-500 text-xs">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-end mb-4">
        <button onClick={() => setAddOpen(true)} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm px-4 py-2.5 rounded-xl transition-colors">
          <Plus size={16} /> Add New Bill
        </button>
      </div>

      {monthBills.length === 0 ? (
        <EmptyState icon={Zap} title="No bills for this month"
          message={`Add a utility bill to split it across ${activeTenants.length} active tenant(s).`}
          actionLabel="Add New Bill" onAction={() => setAddOpen(true)} />
      ) : (
        <div className="space-y-3">
          {monthBills.map(bill => (
            <div key={bill.id} className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm flex items-start justify-between gap-4">
              <div className="flex items-start gap-4 min-w-0">
                <span className={`text-xs font-semibold px-3 py-1 rounded-full border shrink-0 ${TYPE_COLORS[bill.type] ?? TYPE_COLORS.other}`}>
                  {TYPE_LABELS[bill.type] ?? 'Other'}
                </span>
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900">{formatCurrency(bill.totalAmount)}</p>
                  <p className="text-slate-400 text-xs mt-0.5">
                    ~{formatCurrency(bill.perTenantAmount)} × {bill.tenantCount} tenant{bill.tenantCount === 1 ? '' : 's'}
                    {bill.note && ` · ${bill.note}`}
                  </p>
                  {bill.allocations?.length > 0 && (
                    <p className="text-slate-500 text-xs mt-1.5 leading-relaxed">
                      {bill.allocations.map(a => `${tenantName(a.tenantId)} ${formatCurrency(a.amount)}`).join(' · ')}
                    </p>
                  )}
                </div>
              </div>
              <button onClick={() => setDeleting(bill)} aria-label="Delete bill" className="text-slate-400 hover:text-red-500 transition-colors p-1.5 rounded-lg hover:bg-red-50 shrink-0">
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          <p className="text-slate-400 text-xs text-center pt-2">Each share is added to the tenant&apos;s dues in Rent Tracker. Deleting a bill removes those shares.</p>
        </div>
      )}

      <Modal isOpen={addOpen} onClose={() => setAddOpen(false)} title="Add Utility Bill" maxWidth="max-w-lg">
        <AddBillModal tenants={tenants} defaultMonth={month} onSubmit={handleAdd} onClose={() => setAddOpen(false)} />
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
