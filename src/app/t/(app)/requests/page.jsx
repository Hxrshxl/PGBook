'use client'
import { useCallback, useEffect, useState } from 'react'
import { DoorOpen, Info } from 'lucide-react'
import { useResident } from '@/context/ResidentContext'
import { useToast } from '@/context/ToastContext'
import { useAsyncAction } from '@/hooks/useAsyncAction'
import { formatCurrency, formatDate, todayISO } from '@/utils/helpers'
import Spinner from '@/components/ui/Spinner'
import FormError from '@/components/ui/FormError'

const inputCls = 'w-full border border-slate-200 rounded-md px-3 py-2.5 text-base text-slate-900 focus:outline-none focus:border-indigo-500 bg-white'
const addDays = (iso, n) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10)

// Give move-out notice (L1: shows the notice period and what it means for the deposit).
export default function TenantRequests() {
  const { client, tenancyId } = useResident()
  const { showToast } = useToast()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [date, setDate] = useState('')
  const [reason, setReason] = useState('')
  const [confirming, setConfirming] = useState(false)

  const load = useCallback(() => client.get('/resident/summary').then(d => {
    setData(d)
    setDate(addDays(todayISO(), d.property?.noticePeriodDays ?? 30))
  }).catch(e => setError(e.message)), [client])
  useEffect(() => { setData(null); load() }, [load, tenancyId])

  const give = useAsyncAction(async () => {
    await client.post('/resident/moveout', { moveOutDate: date, reason })
    setConfirming(false)
    showToast('Notice sent to your PG.')
    load()
  })
  const withdraw = useAsyncAction(async () => {
    await client.delete(`/resident/moveout/${data.moveOut.id}`)
    showToast('Notice withdrawn.')
    load()
  })

  if (error) return <FormError message={error} />
  if (!data) return <div className="flex justify-center py-20"><Spinner size={26} /></div>
  const noticeDays = data.property?.noticePeriodDays ?? 30
  const earliest = addDays(todayISO(), noticeDays)
  const short = date && date < earliest

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-slate-900">Moving out</h1>
      {data.moveOut ? (
        <section className="bg-white rounded-xl border border-slate-200 p-5">
          <DoorOpen size={22} className="text-amber-600" />
          <p className="font-semibold text-slate-900 mt-2">You&apos;re moving out on {formatDate(data.moveOut.moveOutDate)}</p>
          <p className="text-sm text-slate-500 mt-1">{data.moveOut.status === 'acknowledged' ? 'Your PG has acknowledged it. They will share the deposit settlement around your move-out date.' : 'Waiting for your PG to acknowledge it. You can still withdraw it until then.'}</p>
          {data.moveOut.status === 'pending' && (
            <button onClick={() => withdraw.run()} disabled={withdraw.busy} className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap h-10 px-4 text-sm rounded-md border border-slate-200 bg-white font-medium text-slate-700 shadow-xs transition-colors hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50 mt-4 w-full">{withdraw.busy ? 'Withdrawing…' : 'Withdraw notice'}</button>
          )}
          <FormError message={withdraw.error} />
        </section>
      ) : data.access !== 'full' ? (
        <p className="text-sm text-slate-500">{data.readReason}</p>
      ) : (
        <section className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          <p className="text-sm text-slate-600">Your PG&apos;s notice period is <strong>{noticeDays} days</strong>, so the earliest move-out without a short-notice charge is <strong>{formatDate(earliest)}</strong>.</p>
          <div>
            <label htmlFor="mo-date" className="block text-[13px] font-medium text-slate-700 mb-1.5">Move-out date</label>
            <input id="mo-date" type="date" min={todayISO()} value={date} onChange={e => setDate(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label htmlFor="mo-reason" className="block text-[13px] font-medium text-slate-700 mb-1.5">Reason <span className="text-slate-400 font-normal">(optional)</span></label>
            <input id="mo-reason" maxLength={500} value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Moving to another city" className={inputCls} />
          </div>
          {confirming ? (
            <div className="space-y-3">
              <div className="flex gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 text-sm text-amber-900">
                <Info size={16} className="shrink-0 mt-0.5" />
                <span>
                  {short ? `This is ${Math.ceil((Date.parse(earliest) - Date.parse(date)) / 86400000)} days shorter than the notice period — your PG may deduct for it from your deposit. ` : ''}
                  Your deposit of {formatCurrency(data.stay.depositAmount ?? 0)} is settled against any unpaid dues and deductions after you move out.
                </span>
              </div>
              <FormError message={give.error} />
              <div className="flex gap-3">
                <button onClick={() => setConfirming(false)} disabled={give.busy} className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap h-10 px-4 text-sm rounded-md border border-slate-200 bg-white font-medium text-slate-700 shadow-xs transition-colors hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50 flex-1">Back</button>
                <button onClick={() => give.run()} disabled={give.busy} className="flex-1 py-3 rounded-xl bg-indigo-600 text-white text-sm font-medium disabled:opacity-60">{give.busy ? 'Sending…' : 'Confirm notice'}</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setConfirming(true)} disabled={!date} className="w-full py-3 rounded-xl bg-indigo-600 text-white text-sm font-medium disabled:opacity-60">Give notice</button>
          )}
        </section>
      )}
    </div>
  )
}
