'use client'
import { useState, useRef } from 'react'
import { FileText, Printer } from 'lucide-react'
import { useAppData } from '../../context/AppContext'
import { useToast } from '../../context/ToastContext'
import { getCurrentMonth, formatMonth, getActiveTenants, getMonthPayments, getTotalDue } from '../../utils/helpers'
import MonthSelector from '../../components/ui/MonthSelector'
import EmptyState from '../../components/ui/EmptyState'
import Badge from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import ReceiptTemplate from '../../components/receipts/ReceiptTemplate'

function buildReceiptNumber(tenantId, month) {
  const [year, m] = month.split('-')
  const suffix = tenantId.slice(-4).toUpperCase()
  return `REC-${year}${m}-${suffix}`
}

export default function ReceiptsPage() {
  const { tenants, payments, pgSettings } = useAppData()
  const { showToast } = useToast()
  const [month, setMonth] = useState(getCurrentMonth)
  const [previewing, setPreviewing] = useState(null) // { tenant, payment }
  const printRef = useRef(null)

  const activeTenants = getActiveTenants(tenants)
  const monthPayments = getMonthPayments(payments, month)

  const rows = activeTenants.map(t => ({
    tenant: t,
    payment: monthPayments.find(p => p.tenantId === t.id) ?? null,
  })).filter(r => r.payment && r.payment.amountPaid > 0)

  function handlePrint(tenant, payment) {
    setPreviewing({ tenant, payment })
  }

  function doPrint() {
    const content = printRef.current?.innerHTML
    if (!content) return
    const win = window.open('', '_blank', 'width=800,height=700')
    win.document.write(`<!DOCTYPE html><html><head><title>Receipt</title><style>body{margin:0;padding:20px;}</style></head><body>${content}</body></html>`)
    win.document.close()
    win.focus()
    setTimeout(() => { win.print(); win.close() }, 300)
    showToast('Receipt sent to printer.')
  }

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Space Grotesk' }}>Rent Receipts</h1>
          <p className="text-slate-500 text-sm mt-1">Generate and print receipts for paid tenants</p>
        </div>
        <MonthSelector value={month} onChange={setMonth} />
      </div>

      {/* List */}
      {rows.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No receipts for this month"
          message="Receipts are generated for tenants who have made at least a partial payment. Record payments in Rent Tracker first."
        />
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{rows.length} receipt{rows.length > 1 ? 's' : ''} available for {formatMonth(month)}</p>
          </div>
          <div className="divide-y divide-slate-50">
            {rows.map(({ tenant, payment }) => {
              const receiptNo = buildReceiptNumber(tenant.id, month)
              return (
                <div key={tenant.id} className="flex items-center justify-between px-5 py-4 hover:bg-slate-50/60 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-xs font-bold shrink-0">
                      {tenant.name[0]}
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">{tenant.name}</p>
                      <p className="text-slate-400 text-xs">Room {tenant.room} · {receiptNo}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right hidden sm:block">
                      <p className="font-semibold text-slate-900">₹{(payment.amountPaid ?? 0).toLocaleString('en-IN')}</p>
                      <Badge status={payment.status} />
                    </div>
                    <button
                      onClick={() => handlePrint(tenant, payment)}
                      className="flex items-center gap-1.5 text-sm font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      <Printer size={14} />
                      Print
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Preview modal */}
      <Modal isOpen={!!previewing} onClose={() => setPreviewing(null)} title="Receipt Preview" maxWidth="max-w-2xl">
        {previewing && (
          <div>
            <div ref={printRef}>
              <ReceiptTemplate
                tenant={previewing.tenant}
                payment={previewing.payment}
                pgSettings={pgSettings}
                receiptNumber={buildReceiptNumber(previewing.tenant.id, month)}
              />
            </div>
            <div className="flex justify-end gap-3 mt-5 pt-4 border-t border-slate-100">
              <button onClick={() => setPreviewing(null)} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-xl hover:border-slate-300 transition-colors">
                Close
              </button>
              <button onClick={doPrint} className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-colors">
                <Printer size={15} />
                Print Receipt
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
