'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Megaphone, Pin, Wrench, Clock, CheckCircle2, Info, DoorOpen, PiggyBank } from 'lucide-react'
import { useResident } from '@/context/ResidentContext'
import { useToast } from '@/context/ToastContext'
import { formatCurrency, formatDate, timeAgo } from '@/utils/helpers'
import UpiPay from '@/components/resident/UpiPay'
import ClaimForm from '@/components/resident/ClaimForm'
import Sheet from '@/components/resident/Sheet'
import Spinner from '@/components/ui/Spinner'
import FormError from '@/components/ui/FormError'

const card = 'bg-white rounded-2xl border border-slate-100 shadow-sm'
const STATUS_TEXT = { open: 'Open', 'in-progress': 'In progress', resolved: 'Resolved' }

export default function TenantHome() {
  const { client, tenancyId, resident } = useResident()
  const { showToast } = useToast()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [claiming, setClaiming] = useState(false)

  const load = useCallback(() => client.get('/resident/summary').then(setData).catch(e => setError(e.message)), [client])
  useEffect(() => { setData(null); load() }, [load, tenancyId])

  async function ack(id) {
    try {
      await client.post(`/resident/notices/${id}`)
      load()
    } catch (e) {
      showToast(e.message, 'error')
    }
  }

  if (error) return <FormError message={error} />
  if (!data) return <div className="flex justify-center py-20"><Spinner size={26} /></div>
  const { dues, stay, property } = data
  const full = data.access === 'full'

  return (
    <div className="space-y-4">
      <p className="text-lg font-bold text-slate-900">Hi {(resident?.name || stay.name).split(' ')[0]} 👋</p>

      {data.readReason && (
        <div className="flex gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-2.5 text-sm text-amber-900"><Info size={16} className="shrink-0 mt-0.5" /> {data.readReason}</div>
      )}

      <section className={`${card} p-5`}>
        {dues.totalDue > 0 ? (
          <>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{dues.overdue ? 'Overdue' : 'Due'}</p>
            <p className={`text-3xl font-bold mt-1 ${dues.overdue ? 'text-red-600' : 'text-slate-900'}`}>{formatCurrency(dues.totalDue)}</p>
            <p className="text-xs text-slate-500 mt-1">
              {dues.openMonths.map(m => m.monthLabel).join(', ')} · due by {formatDate(dues.dueDate)}
              {property?.lateFee && ` · late fee after ${property.lateFee.graceDays} day(s)`}
            </p>
            {dues.pendingClaimTotal > 0 && <p className="text-xs text-indigo-700 mt-2 flex items-center gap-1"><Clock size={12} /> {formatCurrency(dues.pendingClaimTotal)} reported by you, waiting for the PG to confirm</p>}
            {full && (
              <div className="mt-4 space-y-3">
                {dues.upi ? <UpiPay upi={dues.upi} /> : dues.payAmount > 0 && <p className="text-xs text-slate-500">Your PG hasn&apos;t added a UPI ID yet. Pay them the usual way.</p>}
                {dues.payAmount > 0 && <button onClick={() => setClaiming(true)} className="w-full py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:border-slate-300">Already paid? Tell your PG</button>}
              </div>
            )}
          </>
        ) : (
          <div className="flex items-center gap-3">
            <CheckCircle2 size={28} className="text-emerald-500" />
            <div><p className="font-semibold text-slate-900">All paid up</p><p className="text-xs text-slate-500">Nothing due right now. Thank you!</p></div>
          </div>
        )}
        <Link href="/t/pay" className="block text-center text-xs font-semibold text-indigo-600 mt-4">See all months & receipts</Link>
      </section>

      {data.settlement && (
        <Link href="/t/me" className={`${card} p-4 flex items-center gap-3`}>
          <PiggyBank size={20} className="text-indigo-600" />
          <div className="flex-1"><p className="text-sm font-semibold text-slate-900">Deposit settlement {data.settlement.status === 'closed' ? 'completed' : 'ready'}</p><p className="text-xs text-slate-500">{data.settlement.refundAmount >= 0 ? `Refund ${formatCurrency(data.settlement.refundAmount)}` : `You owe ${formatCurrency(-data.settlement.refundAmount)}`} · tap to view</p></div>
        </Link>
      )}
      {data.moveOut && (
        <Link href="/t/requests" className={`${card} p-4 flex items-center gap-3`}>
          <DoorOpen size={20} className="text-amber-600" />
          <div className="flex-1"><p className="text-sm font-semibold text-slate-900">Moving out {formatDate(data.moveOut.moveOutDate)}</p><p className="text-xs text-slate-500">{data.moveOut.status === 'acknowledged' ? 'Acknowledged by your PG' : 'Waiting for your PG to acknowledge'}</p></div>
        </Link>
      )}

      <section className={card}>
        <h2 className="px-5 pt-4 pb-2 text-sm font-semibold text-slate-900 flex items-center gap-2"><Megaphone size={15} className="text-slate-400" /> Notices</h2>
        {data.notices.length === 0 ? <p className="px-5 pb-4 text-sm text-slate-400">No notices from your PG.</p> : (
          <ul className="divide-y divide-slate-100">
            {data.notices.map(n => (
              <li key={n.id} className="px-5 py-3">
                <p className="text-sm font-medium text-slate-900 flex items-center gap-1.5">{n.pinned && <Pin size={12} className="text-indigo-500" />}{n.title}</p>
                {n.body && <p className="text-sm text-slate-600 mt-0.5 whitespace-pre-line">{n.body}</p>}
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[11px] text-slate-400">{timeAgo(n.createdAt)}</span>
                  {n.requiresAck && (n.acknowledged
                    ? <span className="text-[11px] text-emerald-600 font-medium">✓ Read</span>
                    : <button onClick={() => ack(n.id)} className="text-xs font-semibold text-indigo-600">Mark as read</button>)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={card}>
        <div className="px-5 pt-4 pb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2"><Wrench size={15} className="text-slate-400" /> Your complaints</h2>
          <Link href="/t/complaints" className="text-xs font-semibold text-indigo-600">{full ? 'Raise / view' : 'View'}</Link>
        </div>
        {data.complaints.length === 0 ? <p className="px-5 pb-4 text-sm text-slate-400">Nothing open.</p> : (
          <ul className="divide-y divide-slate-100">
            {data.complaints.map(c => (
              <li key={c.id} className="px-5 py-3 flex items-center gap-3">
                <p className="text-sm text-slate-700 flex-1 truncate">{c.description}</p>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 shrink-0">{c.status === 'resolved' ? 'Fixed? Confirm' : STATUS_TEXT[c.status]}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {property?.phone && <p className="text-center text-xs text-slate-400">{property.name} · <a href={`tel:${property.phone}`} className="text-indigo-600">{property.phone}</a></p>}

      <Sheet open={claiming} title="Tell your PG you've paid" onClose={() => setClaiming(false)}>
        <ClaimForm months={dues.openMonths} onCancel={() => setClaiming(false)} onDone={() => { setClaiming(false); showToast('Sent. Your PG will confirm it.'); load() }} />
      </Sheet>
    </div>
  )
}
