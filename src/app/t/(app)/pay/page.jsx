'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { FileText, Clock } from 'lucide-react'
import { useResident } from '@/context/ResidentContext'
import { useToast } from '@/context/ToastContext'
import { formatCurrency, formatDate, PAYMENT_METHOD_LABELS } from '@/utils/helpers'
import { printHtml } from '@/utils/print'
import ReceiptTemplate from '@/components/receipts/ReceiptTemplate'
import ClaimForm from '@/components/resident/ClaimForm'
import Sheet from '@/components/resident/Sheet'
import Spinner from '@/components/ui/Spinner'
import FormError from '@/components/ui/FormError'

const STATUS = { paid: 'bg-emerald-50 text-emerald-700', partial: 'bg-blue-50 text-blue-700', pending: 'bg-amber-50 text-amber-700' }
const CLAIM = { pending: ['Waiting for PG', 'text-indigo-700'], approved: ['Confirmed', 'text-emerald-700'], rejected: ['Not confirmed', 'text-red-700'], withdrawn: ['Withdrawn', 'text-slate-400'] }

export default function TenantPay() {
  const { client, tenancyId } = useResident()
  const { showToast } = useToast()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [claiming, setClaiming] = useState(false)
  const [receipt, setReceipt] = useState(null)
  const printRef = useRef(null)

  const load = useCallback(() => client.get('/resident/dues').then(setData).catch(e => setError(e.message)), [client])
  useEffect(() => { setData(null); load() }, [load, tenancyId])

  async function openReceipt(due) {
    try {
      setReceipt(await client.get(`/resident/receipts/${due.id}`))
    } catch (e) {
      showToast(e.message, 'error')
    }
  }
  async function withdraw(claim) {
    try {
      await client.post(`/resident/claims/${claim.id}`, { action: 'withdraw' })
      showToast('Withdrawn.')
      load()
    } catch (e) {
      showToast(e.message, 'error')
    }
  }

  if (error) return <FormError message={error} />
  if (!data) return <div className="flex justify-center py-20"><Spinner size={26} /></div>
  const open = data.dues.filter(d => d.balance > 0).map(d => ({ id: d.id, monthLabel: d.monthLabel, balance: d.balance }))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">Payments</h1>
        {data.access === 'full' && open.length > 0 && <button onClick={() => setClaiming(true)} className="text-sm font-medium text-indigo-700">I&apos;ve paid</button>}
      </div>
      <p className="text-xs text-slate-500">Monthly: rent {formatCurrency(data.stay.rentAmount)}{data.stay.recurringCharges.map(c => ` + ${c.label} ${formatCurrency(c.amount)}`).join('')} = <strong>{formatCurrency(data.stay.monthlyTotal)}</strong>{data.stay.depositAmount ? ` · deposit held ${formatCurrency(data.stay.depositAmount)}` : ''}</p>

      {data.dues.length === 0 && <p className="text-sm text-slate-500 text-center py-10">No dues yet.</p>}
      {data.dues.map(d => (
        <section key={d.id} className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-slate-900">{d.monthLabel}</p>
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full capitalize ${STATUS[d.status]}`}>{d.status}</span>
          </div>
          <div className="text-xs text-slate-500 mt-2 space-y-0.5">
            <div className="flex justify-between"><span>Rent</span><span>{formatCurrency(d.rentAmount)}</span></div>
            {d.extraCharges.map((c, i) => <div key={i} className="flex justify-between"><span>{c.label}</span><span>{formatCurrency(c.amount)}</span></div>)}
            {d.utilityShare > 0 && <div className="flex justify-between"><span>Electricity & utilities (your share)</span><span>{formatCurrency(d.utilityShare)}</span></div>}
            {d.lateFee > 0 && <div className="flex justify-between text-red-600"><span>Late fee</span><span>{formatCurrency(d.lateFee)}</span></div>}
            <div className="flex justify-between font-semibold text-slate-900 border-t border-slate-100 pt-1 mt-1"><span>Total</span><span>{formatCurrency(d.totalDue)}</span></div>
            <div className="flex justify-between"><span>Paid</span><span className="text-emerald-700">{formatCurrency(d.amountPaid)}</span></div>
            {d.balance > 0 && <div className="flex justify-between font-semibold text-amber-700"><span>Still due</span><span>{formatCurrency(d.balance)}</span></div>}
          </div>
          {d.entries.length > 0 && (
            <ul className="mt-2 text-xs text-slate-500 space-y-0.5">
              {d.entries.map(e => <li key={e.id}>{formatDate(e.date)} · {formatCurrency(e.amount)} · {PAYMENT_METHOD_LABELS[e.method] ?? e.method}{e.source === 'deposit' ? ' (from deposit)' : ''}</li>)}
            </ul>
          )}
          {d.claims.map(c => (
            <div key={c.id} className="mt-2 text-xs flex items-center gap-2">
              <Clock size={12} className="text-slate-400" />
              <span className="flex-1">You reported {formatCurrency(c.amount)} on {formatDate(c.date)}{c.utr ? ` (${c.utr})` : ''} — <span className={CLAIM[c.status][1]}>{CLAIM[c.status][0]}</span>{c.decisionNote ? `: ${c.decisionNote}` : ''}</span>
              {c.status === 'pending' && <button onClick={() => withdraw(c)} className="text-slate-500 underline">Withdraw</button>}
            </div>
          ))}
          {d.amountPaid > 0 && (
            <button onClick={() => openReceipt(d)} className="mt-3 flex items-center gap-1.5 text-xs font-medium text-indigo-700"><FileText size={13} /> Receipt</button>
          )}
        </section>
      ))}

      <Sheet open={claiming} title="Tell your PG you've paid" onClose={() => setClaiming(false)}>
        <ClaimForm months={open} onCancel={() => setClaiming(false)} onDone={() => { setClaiming(false); showToast('Sent. Your PG will confirm it.'); load() }} />
      </Sheet>
      <Sheet open={!!receipt} title="Rent receipt" onClose={() => setReceipt(null)}>
        {receipt && (
          <>
            <div ref={printRef} className="overflow-x-auto -mx-2">
              <ReceiptTemplate tenant={receipt.tenant} payment={receipt.payment} pgSettings={receipt.settings} receiptNumber={`RCPT-${receipt.payment.month.replace('-', '')}-${receipt.payment.id.slice(-6).toUpperCase()}`} />
            </div>
            <button onClick={() => printHtml(printRef.current.innerHTML, `Receipt ${receipt.payment.month}`)} className="mt-4 w-full py-3 rounded-xl bg-indigo-600 text-white text-sm font-medium">Save as PDF / Print</button>
          </>
        )}
      </Sheet>
    </div>
  )
}
