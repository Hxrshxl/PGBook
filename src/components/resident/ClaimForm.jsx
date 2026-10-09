'use client'
import { useState } from 'react'
import { Camera, X } from 'lucide-react'
import { useResident } from '@/context/ResidentContext'
import { useAsyncAction } from '@/hooks/useAsyncAction'
import { uploadPhoto } from '@/utils/imageUpload'
import { todayISO } from '@/utils/helpers'
import FormError from '@/components/ui/FormError'

const inputCls = 'w-full border border-slate-200 rounded-xl px-3 py-2.5 text-base text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500'
const labelCls = 'block text-slate-700 text-sm font-medium mb-1.5'

// "I've paid": months with a balance → amount, date, UTR and an optional screenshot.
export default function ClaimForm({ months, onDone, onCancel }) {
  const { client } = useResident()
  const [form, setForm] = useState(() => ({
    paymentId: months[0]?.id ?? '', amount: String(months[0]?.balance ?? ''), date: todayISO(), method: 'upi', utr: '', note: '',
  }))
  const [shot, setShot] = useState(null)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const { run, busy, error } = useAsyncAction(async () => {
    const screenshotId = shot ? await uploadPhoto(client, shot) : undefined
    await client.post('/resident/claims', { ...form, amount: Number(form.amount), screenshotId })
    onDone()
  })

  function chooseMonth(id) {
    const m = months.find(x => x.id === id)
    setForm(f => ({ ...f, paymentId: id, amount: String(m?.balance ?? f.amount) }))
  }

  return (
    <form onSubmit={e => { e.preventDefault(); run() }} className="space-y-4">
      <div>
        <label htmlFor="c-month" className={labelCls}>For which month?</label>
        <select id="c-month" value={form.paymentId} onChange={e => chooseMonth(e.target.value)} className={inputCls}>
          {months.map(m => <option key={m.id} value={m.id}>{m.monthLabel} — ₹{m.balance.toLocaleString('en-IN')} due</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="c-amount" className={labelCls}>Amount paid</label>
          <input id="c-amount" type="number" inputMode="decimal" min="1" step="0.01" required value={form.amount} onChange={e => set('amount', e.target.value)} className={inputCls} />
        </div>
        <div>
          <label htmlFor="c-date" className={labelCls}>Paid on</label>
          <input id="c-date" type="date" required max={todayISO()} value={form.date} onChange={e => set('date', e.target.value)} className={inputCls} />
        </div>
      </div>
      <div>
        <label htmlFor="c-method" className={labelCls}>How?</label>
        <select id="c-method" value={form.method} onChange={e => set('method', e.target.value)} className={inputCls}>
          <option value="upi">UPI (GPay, PhonePe, Paytm…)</option>
          <option value="bank">Bank transfer</option>
          <option value="cash">Cash to the PG</option>
        </select>
      </div>
      {form.method !== 'cash' && (
        <div>
          <label htmlFor="c-utr" className={labelCls}>UTR / reference number</label>
          <input id="c-utr" required minLength={6} maxLength={40} value={form.utr} onChange={e => set('utr', e.target.value)} placeholder="12-digit number in your payment app" className={inputCls} />
        </div>
      )}
      <div>
        <p className={labelCls}>Screenshot <span className="text-slate-400 font-normal">(optional)</span></p>
        {shot ? (
          <div className="flex items-center gap-2 text-sm text-slate-700"><Camera size={15} /> <span className="truncate flex-1">{shot.name}</span><button type="button" onClick={() => setShot(null)} aria-label="Remove screenshot" className="text-slate-400"><X size={16} /></button></div>
        ) : (
          <label className="flex items-center justify-center gap-2 border border-dashed border-slate-300 rounded-xl py-3 text-sm text-slate-500 cursor-pointer hover:border-indigo-400">
            <Camera size={16} /> Add payment screenshot
            <input type="file" accept="image/*" className="sr-only" onChange={e => setShot(e.target.files?.[0] ?? null)} />
          </label>
        )}
      </div>
      <p className="text-xs text-slate-500">Your PG checks their account and confirms it. Your receipt appears once confirmed.</p>
      <FormError message={error} />
      <div className="flex gap-3">
        <button type="button" onClick={onCancel} disabled={busy} className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium disabled:opacity-50">Cancel</button>
        <button type="submit" disabled={busy || !form.paymentId} className="flex-1 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold disabled:opacity-60">{busy ? 'Sending…' : 'Send to PG'}</button>
      </div>
    </form>
  )
}
