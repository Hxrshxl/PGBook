'use client'
import { useState } from 'react'
import { Plus, Zap, Trash2 } from 'lucide-react'
import { useAppData } from '@/context/AppContext'
import { useToast } from '@/context/ToastContext'
import { getCurrentMonth, formatCurrency, formatMonth, getActiveTenants } from '@/utils/helpers'
import MonthSelector from '@/components/ui/MonthSelector'
import Modal from '@/components/ui/Modal'
import EmptyState from '@/components/ui/EmptyState'
import AddBillModal from '@/components/utilities/AddBillModal'

const TYPE_LABELS = { electricity: 'Electricity', water: 'Water', maintenance: 'Maintenance', internet: 'Internet', other: 'Other' }
const TYPE_COLORS = {
  electricity: 'bg-amber-50 text-amber-700 border-amber-200',
  water:       'bg-blue-50 text-blue-700 border-blue-200',
  maintenance: 'bg-purple-50 text-purple-700 border-purple-200',
  internet:    'bg-teal-50 text-teal-700 border-teal-200',
  other:       'bg-slate-50 text-slate-700 border-slate-200',
}

export default function UtilitySplitterPage() {
  const { tenants, utilityBills, addUtilityBill, deleteUtilityBill } = useAppData()
  const { showToast } = useToast()
  const [month, setMonth] = useState(getCurrentMonth)
  const [addOpen, setAddOpen] = useState(false)

  const activeTenants = getActiveTenants(tenants)
  const monthBills = utilityBills.filter(b => b.month === month)
  const totalForMonth = monthBills.reduce((s, b) => s + b.totalAmount, 0)

  async function handleAdd({ type, totalAmount, month: billMonth, perTenantAmount }) {
    try {
      await addUtilityBill({ type, totalAmount, month: billMonth, perTenantAmount, splitMethod: 'equal', tenantCount: activeTenants.length })
      setAddOpen(false)
      showToast(`${TYPE_LABELS[type] || 'Bill'} of ${formatCurrency(totalAmount)} split across ${activeTenants.length} tenants.`)
    } catch (err) {
      showToast(err.message ?? 'Failed to add bill.', 'error')
    }
  }

  async function handleDelete(bill) {
    try {
      await deleteUtilityBill(bill.id)
      showToast('Bill removed. Existing tenant dues are not automatically reversed.', 'warning')
    } catch (err) {
      showToast(err.message ?? 'Failed to delete bill.', 'error')
    }
  }

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Utility Bill Splitter</h1>
          <p className="text-slate-500 text-sm mt-1">Split electricity, water, and other bills equally across tenants</p>
        </div>
        <MonthSelector value={month} onChange={setMonth} />
      </div>

      {monthBills.length > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: 'Bills this month', value: monthBills.length },
            { label: 'Total split', value: formatCurrency(totalForMonth) },
            { label: 'Active tenants', value: activeTenants.length },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
              <p className="text-2xl font-bold text-slate-900 mb-0.5">{s.value}</p>
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
          message={`Add a utility bill to split it equally across ${activeTenants.length} active tenants.`}
          actionLabel="Add New Bill" onAction={() => setAddOpen(true)} />
      ) : (
        <div className="space-y-3">
          {monthBills.map(bill => (
            <div key={bill.id} className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${TYPE_COLORS[bill.type] ?? TYPE_COLORS.other}`}>
                  {TYPE_LABELS[bill.type] ?? 'Other'}
                </span>
                <div>
                  <p className="font-semibold text-slate-900">{formatCurrency(bill.totalAmount)}</p>
                  <p className="text-slate-400 text-xs mt-0.5">{formatCurrency(bill.perTenantAmount)} × {bill.tenantCount} tenants · Equal split</p>
                </div>
              </div>
              <button onClick={() => handleDelete(bill)} className="text-slate-400 hover:text-red-500 transition-colors p-1.5 rounded-lg hover:bg-red-50">
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          <p className="text-slate-400 text-xs text-center pt-2">Bills added here automatically update each tenant's dues in Rent Tracker.</p>
        </div>
      )}

      <Modal isOpen={addOpen} onClose={() => setAddOpen(false)} title="Add Utility Bill" maxWidth="max-w-md">
        <AddBillModal activeTenantCount={activeTenants.length} defaultMonth={month} onSubmit={handleAdd} onClose={() => setAddOpen(false)} />
      </Modal>
    </div>
  )
}
