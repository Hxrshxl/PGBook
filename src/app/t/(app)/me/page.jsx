'use client'
import { useCallback, useEffect, useState } from 'react'
import { Download, LogOut } from 'lucide-react'
import { useResident } from '@/context/ResidentContext'
import { useToast } from '@/context/ToastContext'
import { useAsyncAction } from '@/hooks/useAsyncAction'
import { formatCurrency, formatDate } from '@/utils/helpers'
import Spinner from '@/components/ui/Spinner'
import FormError from '@/components/ui/FormError'

const card = 'bg-white rounded-xl border border-slate-200 p-5'
const row = (k, v) => <div key={k} className="flex justify-between gap-3 text-sm"><span className="text-slate-500">{k}</span><span className="text-slate-900 text-right">{v}</span></div>

function Settlement({ s, onChange }) {
  const { client } = useResident()
  const [disputing, setDisputing] = useState(false)
  const [comment, setComment] = useState('')
  const { run, busy, error } = useAsyncAction(async action => {
    await client.post(`/resident/settlement/${s.id}`, { action, comment })
    setDisputing(false)
    onChange()
  })
  const dues = s.unpaidDues.reduce((t, d) => t + d.amount, 0)
  return (
    <section className={card}>
      <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">Deposit settlement</h2>
      <div className="mt-3 space-y-1.5">
        {row('Deposit', formatCurrency(s.deposit))}
        {s.unpaidDues.map(d => row(`Unpaid · ${d.monthLabel}`, `− ${formatCurrency(d.amount)}`))}
        {s.deductions.map(d => row(d.label, `− ${formatCurrency(d.amount)}`))}
        <div className="flex justify-between border-t border-slate-100 pt-1.5 font-semibold text-sm">
          <span>{s.refundAmount >= 0 ? 'Refund to you' : 'You owe'}</span><span className={s.refundAmount >= 0 ? 'text-emerald-700' : 'text-red-700'}>{formatCurrency(Math.abs(s.refundAmount))}</span>
        </div>
      </div>
      {s.notes && <p className="text-xs text-slate-500 mt-2 whitespace-pre-line">{s.notes}</p>}
      {dues > 0 && <p className="text-xs text-slate-500 mt-2">Unpaid dues are paid from your deposit when the settlement is closed.</p>}
      {s.status === 'closed' && s.refund && <p className="text-sm text-emerald-700 mt-3">Refund of {formatCurrency(s.refund.amount)} sent on {formatDate(s.refund.date)}{s.refund.reference ? ` · ref ${s.refund.reference}` : ''}.</p>}
      {s.status === 'accepted' && <p className="text-sm text-slate-600 mt-3">You accepted this on {formatDate(String(s.tenantResponse.at).slice(0, 10))}. Your PG will send the refund.</p>}
      {s.status === 'disputed' && <p className="text-sm text-red-700 mt-3">You disputed this: “{s.tenantResponse.comment}”. Your PG may revise it.</p>}
      {['shared', 'disputed'].includes(s.status) && (
        disputing ? (
          <div className="mt-3 space-y-2">
            <textarea rows={3} maxLength={1000} value={comment} onChange={e => setComment(e.target.value)} placeholder="What do you disagree with?" aria-label="Your comment" className="w-full border border-slate-200 rounded-xl px-3 py-2 text-base resize-none" />
            <div className="flex gap-2">
              <button onClick={() => setDisputing(false)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm">Back</button>
              <button onClick={() => run('dispute')} disabled={busy || comment.trim().length < 5} className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold disabled:opacity-50">Send dispute</button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2 mt-4">
            <button onClick={() => setDisputing(true)} className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap h-10 px-4 text-sm rounded-md border border-slate-200 bg-white font-medium text-slate-700 shadow-xs transition-colors hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50 flex-1">Dispute</button>
            {s.status === 'shared' && <button onClick={() => run('accept')} disabled={busy} className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold disabled:opacity-60">Accept</button>}
          </div>
        )
      )}
      <FormError message={error} />
    </section>
  )
}

export default function TenantMe() {
  const { client, tenancyId, resident, logout } = useResident()
  const { showToast } = useToast()
  const [data, setData] = useState(null)
  const [settlement, setSettlement] = useState(undefined)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      const [summary, s] = await Promise.all([client.get('/resident/summary'), client.get('/resident/settlement')])
      setData(summary)
      setSettlement(s.settlement)
    } catch (e) {
      setError(e.message)
    }
  }, [client])
  useEffect(() => { setData(null); load() }, [load, tenancyId])

  async function download() {
    try {
      const res = await fetch('/api/resident/export', { credentials: 'same-origin' })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message ?? 'Could not download.')
      const url = URL.createObjectURL(await res.blob())
      const a = Object.assign(document.createElement('a'), { href: url, download: 'my-pgbook-data.json' })
      document.body.appendChild(a); a.click(); a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (e) {
      showToast(e.message, 'error')
    }
  }

  if (error) return <FormError message={error} />
  if (!data) return <div className="flex justify-center py-20"><Spinner size={26} /></div>
  const { stay, property } = data

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-slate-900">Me</h1>
      {settlement && <Settlement s={settlement} onChange={() => { showToast('Sent to your PG.'); load() }} />}

      <section className={card}>
        <h2 className="text-sm font-semibold text-slate-900 mb-3">My stay</h2>
        <div className="space-y-1.5">
          {row('Name', stay.name)}
          {row('PG', property?.name ?? '—')}
          {row('Room', stay.room)}
          {row('Moved in', stay.moveInDate ? formatDate(stay.moveInDate) : '—')}
          {stay.moveOutDate && row('Moved out', formatDate(stay.moveOutDate))}
          {row('Monthly', formatCurrency(stay.monthlyTotal))}
          {row('Deposit held', formatCurrency(stay.depositAmount ?? 0))}
          {row('Notice period', `${property?.noticePeriodDays ?? 30} days`)}
          {stay.emergencyContact?.name && row('Emergency contact', `${stay.emergencyContact.name}${stay.emergencyContact.phone ? ` · ${stay.emergencyContact.phone}` : ''}`)}
        </div>
        <p className="text-xs text-slate-500 mt-3">Something wrong? Ask your PG to correct it.</p>
      </section>

      <section className={card}>
        <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">Privacy</h2>
        <p className="text-xs text-slate-500 mt-1">Signed in as +{resident?.phone}. Only you and your PG see your data.</p>
        <button onClick={download} className="mt-3 flex items-center gap-2 text-sm font-medium text-indigo-700"><Download size={15} /> Download my data</button>
      </section>

      <button onClick={logout} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-red-600"><LogOut size={15} /> Sign out</button>
    </div>
  )
}
