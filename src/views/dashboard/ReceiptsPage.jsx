'use client'
import { useState, useRef } from 'react'
import { FileText, Printer } from 'lucide-react'
import { useAppData } from '@/context/AppContext'
import { useToast } from '@/context/ToastContext'
import { getCurrentMonth, formatMonth, formatCurrency, getMonthPayments } from '@/utils/helpers'
import MonthSelector from '@/components/ui/MonthSelector'
import EmptyState from '@/components/ui/EmptyState'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import ReceiptTemplate from '@/components/receipts/ReceiptTemplate'

// Unique per dues record: month + the end of the record's id.
function buildReceiptNumber(payment) {
  return `RCPT-${payment.month.replace('-', '')}-${payment.id.slice(-6).toUpperCase()}`
}

// Prints the given HTML through a hidden iframe, so popup blockers never interfere.
function printHtml(html, title) {
  const frame = document.createElement('iframe')
  frame.setAttribute('aria-hidden', 'true')
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;'
  document.body.appendChild(frame)
  const doc = frame.contentWindow.document
  doc.open()
  doc.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title><style>body{margin:0;padding:20px;-webkit-print-color-adjust:exact;print-color-adjust:exact;}</style></head><body>${html}</body></html>`)
  doc.close()
  frame.contentWindow.focus()
  setTimeout(() => {
    frame.contentWindow.print()
    setTimeout(() => frame.remove(), 1000)
  }, 250)
}

export default function ReceiptsPage() {
  const { tenants, payments, settingsFor } = useAppData()
  const { showToast } = useToast()
  const [month, setMonth] = useState(getCurrentMonth)
  const [previewingId, setPreviewingId] = useState(null)
  const printRef = useRef(null)

  const tenantById = new Map(tenants.map(t => [t.id, t]))
  const rows = getMonthPayments(payments, month)
    .filter(p => p.amountPaid > 0 && tenantById.has(p.tenantId))
    .map(p => ({ tenant: tenantById.get(p.tenantId), payment: p }))
    .sort((a, b) => a.tenant.room.localeCompare(b.tenant.room, undefined, { numeric: true }))
  const previewing = rows.find(r => r.payment.id === previewingId) ?? null

  function doPrint() {
    const content = printRef.current?.innerHTML
    if (!content) return
    printHtml(content, buildReceiptNumber(previewing.payment))
    showToast('Opening the print dialog — choose "Save as PDF" to download.', 'info')
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Rent Receipts</h1>
          <p className="text-slate-500 text-sm mt-1">Print or save receipts as PDF for tenants who have paid</p>
        </div>
        <MonthSelector value={month} onChange={setMonth} />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No receipts for this month"
          message="Receipts are available once a payment is recorded in Rent Tracker."
        />
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{rows.length} receipt{rows.length > 1 ? 's' : ''} for {formatMonth(month)}</p>
          </div>
          <div className="divide-y divide-slate-50">
            {rows.map(({ tenant, payment }) => (
              <div key={payment.id} className="flex items-center justify-between gap-3 px-5 py-4 hover:bg-slate-50/60 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-xs font-bold shrink-0">
                    {tenant.name[0]}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900 truncate">{tenant.name}</p>
                    <p className="text-slate-400 text-xs truncate">Room {tenant.room} · {buildReceiptNumber(payment)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <div className="text-right hidden sm:block">
                    <p className="font-semibold text-slate-900">{formatCurrency(payment.amountPaid)}</p>
                    <Badge status={payment.status} />
                  </div>
                  <button
                    onClick={() => setPreviewingId(payment.id)}
                    className="flex items-center gap-1.5 text-sm font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <Printer size={14} />
                    View
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <Modal isOpen={!!previewing} onClose={() => setPreviewingId(null)} title="Receipt Preview" maxWidth="max-w-2xl">
        {previewing && (
          <div>
            <div ref={printRef} className="overflow-x-auto">
              <ReceiptTemplate
                tenant={previewing.tenant}
                payment={previewing.payment}
                pgSettings={settingsFor(previewing.payment)}
                receiptNumber={buildReceiptNumber(previewing.payment)}
              />
            </div>
            {!settingsFor(previewing.payment).pgName && (
              <p className="text-amber-700 text-xs bg-amber-50 rounded-lg px-3 py-2 mt-4">Tip: add your PG name, address and phone in Settings so they appear on receipts.</p>
            )}
            <div className="flex justify-end gap-3 mt-5 pt-4 border-t border-slate-100">
              <button onClick={() => setPreviewingId(null)} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-xl hover:border-slate-300 transition-colors">
                Close
              </button>
              <button onClick={doPrint} className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-colors">
                <Printer size={15} />
                Print / Save PDF
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
