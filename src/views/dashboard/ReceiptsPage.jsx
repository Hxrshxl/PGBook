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
import { printHtml } from '@/utils/print'
import PageHeader from '@/components/ui/PageHeader'
import { btn, button, page } from '@/components/ui/styles'

// Unique per dues record: month + the end of the record's id.
function buildReceiptNumber(payment) {
  return `RCPT-${payment.month.replace('-', '')}-${payment.id.slice(-6).toUpperCase()}`
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
    <div className={`${page} mx-auto max-w-4xl`}>
      <PageHeader
        title="Receipts"
        description="Print or save a PDF receipt for any tenant who has paid."
        actions={<MonthSelector value={month} onChange={setMonth} />}
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No receipts for this month"
          message="A receipt is available as soon as a payment is recorded on the Rent page."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                <th scope="col" className="py-2.5 pl-5 pr-3 font-medium">Tenant</th>
                <th scope="col" className="hidden px-3 py-2.5 font-medium sm:table-cell">Receipt no.</th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">Paid</th>
                <th scope="col" className="hidden px-3 py-2.5 font-medium sm:table-cell">Status</th>
                <th scope="col" className="py-2.5 pl-3 pr-5"><span className="sr-only">Open</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map(({ tenant, payment }) => (
                <tr key={payment.id} className="hover:bg-slate-50/70">
                  <td className="py-2.5 pl-5 pr-3">
                    <p className="font-medium text-slate-900">{tenant.name}</p>
                    <p className="text-xs text-slate-500">Room {tenant.room}</p>
                  </td>
                  <td className="hidden px-3 py-2.5 font-mono text-xs text-slate-600 sm:table-cell">{buildReceiptNumber(payment)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-slate-900">{formatCurrency(payment.amountPaid)}</td>
                  <td className="hidden px-3 py-2.5 sm:table-cell"><Badge status={payment.status} /></td>
                  <td className="py-2.5 pl-3 pr-5 text-right">
                    <button onClick={() => setPreviewingId(payment.id)} className={button('secondary', 'xs')}><Printer size={13} /> View</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal isOpen={!!previewing} onClose={() => setPreviewingId(null)} title="Receipt" description={previewing ? `${previewing.tenant.name} · ${formatMonth(month)}` : undefined} maxWidth="max-w-2xl">
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
              <p className="mt-4 text-xs text-slate-500">Add your PG name, address and phone in Settings so they appear on receipts.</p>
            )}
            <div className="flex justify-end gap-3 mt-5 pt-4 border-t border-slate-100">
              <button onClick={() => setPreviewingId(null)} className={btn.secondary}>
                Close
              </button>
              <button onClick={doPrint} className={btn.primary}>
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
