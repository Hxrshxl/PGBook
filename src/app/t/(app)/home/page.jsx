'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Clock, CheckCircle2, Info, ChevronRight } from 'lucide-react'
import { useResident } from '@/context/ResidentContext'
import { useToast } from '@/context/ToastContext'
import { formatCurrency, formatDate, timeAgo } from '@/utils/helpers'
import UpiPay from '@/components/resident/UpiPay'
import ClaimForm from '@/components/resident/ClaimForm'
import Sheet from '@/components/resident/Sheet'
import Spinner from '@/components/ui/Spinner'
import FormError from '@/components/ui/FormError'
import Badge from '@/components/ui/Badge'
import { button } from '@/components/ui/styles'

const card = 'bg-white rounded-xl border border-slate-200'
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
      <h1 className="pt-1 text-xl font-semibold tracking-tight text-slate-900">Hi {(resident?.name || stay.name).split(' ')[0]}</h1>

      {data.readReason && (
        <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-900"><Info size={16} className="mt-0.5 shrink-0" /> {data.readReason}</div>
      )}

      <section className={`${card} p-5`}>
        {dues.totalDue > 0 ? (
          <>
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm text-slate-500">To pay</p>
              {dues.overdue && <Badge tone="red">Overdue</Badge>}
            </div>
            <p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums text-slate-900">{formatCurrency(dues.totalDue)}</p>
            <p className="text-xs text-slate-500 mt-1">
              {dues.openMonths.map(m => m.monthLabel).join(', ')} · due by {formatDate(dues.dueDate)}
              {property?.lateFee && ` · late fee after ${property.lateFee.graceDays} day(s)`}
            </p>
            {dues.pendingClaimTotal > 0 && <p className="mt-2 flex items-center gap-1 text-xs text-slate-600"><Clock size={12} /> {formatCurrency(dues.pendingClaimTotal)} reported by you, waiting for the PG to confirm</p>}
            {full && (
              <div className="mt-4 space-y-3">
                {dues.upi ? <UpiPay upi={dues.upi} /> : dues.payAmount > 0 && <p className="text-xs text-slate-500">Your PG hasn&apos;t added a UPI ID yet. Pay them the usual way.</p>}
                {dues.payAmount > 0 && <button onClick={() => setClaiming(true)} className={`${button('secondary', 'lg')} h-11 w-full`}>Already paid? Tell your PG</button>}
              </div>
            )}
          </>
        ) : (
          <div className="flex items-center gap-3">
            <CheckCircle2 size={24} className="text-emerald-600" />
            <div><p className="font-semibold text-slate-900">All paid up</p><p className="text-xs text-slate-500">Nothing due right now. Thank you!</p></div>
          </div>
        )}
        <Link href="/t/pay" className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-sm font-medium text-slate-700 hover:text-slate-900">All months and receipts <ChevronRight size={16} className="text-slate-400" /></Link>
      </section>

      {data.settlement && (
        <Link href="/t/me" className={`${card} p-4 flex items-center gap-3`}>
          <div className="flex-1"><p className="text-sm font-medium text-slate-900">Deposit settlement {data.settlement.status === 'closed' ? 'completed' : 'ready'}</p><p className="text-xs text-slate-500">{data.settlement.refundAmount >= 0 ? `Refund ${formatCurrency(data.settlement.refundAmount)}` : `You owe ${formatCurrency(-data.settlement.refundAmount)}`} </p></div>
          <ChevronRight size={16} className="text-slate-400" />
        </Link>
      )}
      {data.moveOut && (
        <Link href="/t/requests" className={`${card} p-4 flex items-center gap-3`}>
          <div className="flex-1"><p className="text-sm font-medium text-slate-900">Moving out {formatDate(data.moveOut.moveOutDate)}</p><p className="text-xs text-slate-500">{data.moveOut.status === 'acknowledged' ? 'Acknowledged by your PG' : 'Waiting for your PG to acknowledge'}</p></div>
          <ChevronRight size={16} className="text-slate-400" />
        </Link>
      )}

      <section className={card}>
        <h2 className="border-b border-slate-100 px-5 py-3 text-sm font-semibold text-slate-900">Notices</h2>
        {data.notices.length === 0 ? <p className="px-5 py-4 text-sm text-slate-500">No notices from your PG.</p> : (
          <ul className="divide-y divide-slate-100">
            {data.notices.map(n => (
              <li key={n.id} className="px-5 py-3">
                <p className="flex items-center gap-2 text-sm font-medium text-slate-900">{n.title}{n.pinned && <Badge tone="blue">Pinned</Badge>}</p>
                {n.body && <p className="text-sm text-slate-600 mt-0.5 whitespace-pre-line">{n.body}</p>}
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs text-slate-500">{timeAgo(n.createdAt)}</span>
                  {n.requiresAck && (n.acknowledged
                    ? <Badge tone="green">Read</Badge>
                    : <button onClick={() => ack(n.id)} className={button('secondary', 'xs')}>Mark as read</button>)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={card}>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <h2 className="text-sm font-semibold text-slate-900">Your complaints</h2>
          <Link href="/t/complaints" className="text-sm font-medium text-slate-700 hover:text-slate-900">{full ? 'Raise or view' : 'View'}</Link>
        </div>
        {data.complaints.length === 0 ? <p className="px-5 py-4 text-sm text-slate-500">Nothing open.</p> : (
          <ul className="divide-y divide-slate-100">
            {data.complaints.map(c => (
              <li key={c.id} className="px-5 py-3 flex items-center gap-3">
                <p className="text-sm text-slate-700 flex-1 truncate">{c.description}</p>
                {c.status === 'resolved' ? <Badge tone="amber">Fixed? Confirm</Badge> : <Badge status={c.status}>{STATUS_TEXT[c.status]}</Badge>}
              </li>
            ))}
          </ul>
        )}
      </section>

      {property?.phone && <p className="text-center text-xs text-slate-500">{property.name} · <a href={`tel:${property.phone}`} className="font-medium text-slate-900">{property.phone}</a></p>}

      <Sheet open={claiming} title="Tell your PG you've paid" onClose={() => setClaiming(false)}>
        <ClaimForm months={dues.openMonths} onCancel={() => setClaiming(false)} onDone={() => { setClaiming(false); showToast('Sent. Your PG will confirm it.'); load() }} />
      </Sheet>
    </div>
  )
}
