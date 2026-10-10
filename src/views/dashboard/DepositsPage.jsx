'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { api } from '@/utils/api'
import { useAppData } from '@/context/AppContext'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { useAsyncAction } from '@/hooks/useAsyncAction'
import { formatCurrency, formatDate, formatMonth, roundMoney, todayISO } from '@/utils/helpers'
import Modal from '@/components/ui/Modal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import FormError from '@/components/ui/FormError'
import Spinner from '@/components/ui/Spinner'
import Badge from '@/components/ui/Badge'
import PageHeader from '@/components/ui/PageHeader'
import StatStrip from '@/components/ui/StatStrip'
import Panel from '@/components/ui/Panel'
import { button, page } from '@/components/ui/styles'

const inputCls = 'w-full border border-slate-200 rounded-md px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 transition-colors bg-white'
const labelCls = 'block text-[13px] font-medium text-slate-700 mb-1.5'
const PRESETS = ['Room cleaning', 'Damage repair', 'Key / access card not returned', 'Short notice (days)', 'Painting']

const STATUS = {
  draft: ['Draft', 'gray'],
  pending_approval: ['Waiting for owner', 'amber'],
  shared: ['Shared with tenant', 'blue'],
  accepted: ['Accepted by tenant', 'green'],
  disputed: ['Disputed', 'red'],
  closed: ['Closed', 'gray'],
}

const sum = list => roundMoney((list ?? []).reduce((s, d) => s + (Number(d.amount) || 0), 0))

function SettlementEditor({ settlement, onSave, onCancel }) {
  const [deductions, setDeductions] = useState(() => settlement.deductions.map(d => ({ label: d.label, amount: String(d.amount) })))
  const [notes, setNotes] = useState(settlement.notes ?? '')
  const [moveOutDate, setMoveOutDate] = useState(settlement.moveOutDate)
  const { run, busy, error } = useAsyncAction(onSave)
  const dues = sum(settlement.unpaidDues)
  const refund = roundMoney(settlement.deposit - dues - sum(deductions))
  const setRow = (i, k, v) => setDeductions(list => list.map((d, j) => (j === i ? { ...d, [k]: v } : d)))

  return (
    <form onSubmit={e => { e.preventDefault(); run({ deductions: deductions.filter(d => d.label.trim()).map(d => ({ label: d.label, amount: Number(d.amount) || 0 })), notes, moveOutDate }) }} className="space-y-4">
      <div className="bg-slate-50 rounded-xl p-4 text-sm space-y-1.5">
        <div className="flex justify-between"><span className="text-slate-500">Deposit held</span><span className="font-medium">{formatCurrency(settlement.deposit)}</span></div>
        {settlement.unpaidDues.map(d => (
          <div key={d.month} className="flex justify-between"><span className="text-slate-500">Unpaid dues · {formatMonth(d.month)}</span><span className="text-red-600">− {formatCurrency(d.amount)}</span></div>
        ))}
        {deductions.filter(d => d.label.trim()).map((d, i) => (
          <div key={i} className="flex justify-between"><span className="text-slate-500">{d.label}</span><span className="text-red-600">− {formatCurrency(Number(d.amount) || 0)}</span></div>
        ))}
        <div className="flex justify-between border-t border-slate-200 pt-1.5 font-semibold">
          <span>{refund >= 0 ? 'Refund to tenant' : 'Tenant still owes'}</span><span className={refund >= 0 ? 'text-emerald-700' : 'text-red-700'}>{formatCurrency(Math.abs(refund))}</span>
        </div>
      </div>
      <div>
        <p className={labelCls}>Deductions</p>
        {deductions.map((d, i) => (
          <div key={i} className="flex gap-2 mb-2">
            <input aria-label="Deduction" required maxLength={80} value={d.label} onChange={e => setRow(i, 'label', e.target.value)} className={inputCls} />
            <input aria-label="Amount" required type="number" min="0" step="1" value={d.amount} onChange={e => setRow(i, 'amount', e.target.value)} className={`${inputCls} max-w-32`} />
            <button type="button" onClick={() => setDeductions(list => list.filter((_, j) => j !== i))} aria-label="Remove" className="px-2 text-slate-400 hover:text-red-600"><X size={16} /></button>
          </div>
        ))}
        <div className="flex flex-wrap gap-2">
          {PRESETS.map(label => (
            <button key={label} type="button" onClick={() => setDeductions(list => [...list, { label, amount: '' }])} className="flex items-center gap-1 text-xs font-medium text-slate-600 border border-dashed border-slate-300 hover:border-indigo-400 hover:text-indigo-600 rounded-lg px-2.5 py-1">
              <Plus size={12} /> {label}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="s-date" className={labelCls}>Move-out date</label>
          <input id="s-date" type="date" required value={moveOutDate} onChange={e => setMoveOutDate(e.target.value)} className={inputCls} />
        </div>
      </div>
      <div>
        <label htmlFor="s-notes" className={labelCls}>Notes for the tenant</label>
        <textarea id="s-notes" rows={2} maxLength={1000} value={notes} onChange={e => setNotes(e.target.value)} className={`${inputCls} resize-none`} />
      </div>
      <p className="text-xs text-slate-400">Unpaid dues are taken from the ledger automatically. A shared settlement goes back to draft when edited and must be shared again.</p>
      <FormError message={error} />
      <div className="flex justify-end gap-3">
        <button type="button" onClick={onCancel} disabled={busy} className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap h-9 px-3.5 text-sm rounded-md border border-slate-200 bg-white font-medium text-slate-700 shadow-xs transition-colors hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50">Cancel</button>
        <button type="submit" disabled={busy} className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap h-9 px-3.5 text-sm rounded-md bg-indigo-600 font-medium text-white shadow-xs transition-colors hover:bg-indigo-700 disabled:opacity-50">{busy ? 'Saving…' : 'Save'}</button>
      </div>
    </form>
  )
}

function RefundForm({ settlement, onSubmit, onCancel }) {
  const [form, setForm] = useState({ amount: String(Math.max(0, settlement.refundAmount)), method: 'upi', reference: '', date: todayISO() })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const { run, busy, error } = useAsyncAction(onSubmit)
  return (
    <form onSubmit={e => { e.preventDefault(); run({ ...form, amount: Number(form.amount) || 0 }) }} className="space-y-4">
      <p className="text-sm text-slate-600">Closing settles {formatCurrency(sum(settlement.unpaidDues))} of unpaid dues from the deposit on the ledger and marks {settlement.tenantName} as moved out on {formatDate(settlement.moveOutDate)}.</p>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="r-amount" className={labelCls}>Refund paid</label>
          <input id="r-amount" type="number" min="0" step="1" value={form.amount} onChange={e => set('amount', e.target.value)} className={inputCls} />
        </div>
        <div>
          <label htmlFor="r-date" className={labelCls}>Date</label>
          <input id="r-date" type="date" required max={todayISO()} value={form.date} onChange={e => set('date', e.target.value)} className={inputCls} />
        </div>
        <div>
          <label htmlFor="r-method" className={labelCls}>Paid by</label>
          <select id="r-method" value={form.method} onChange={e => set('method', e.target.value)} className={inputCls}>
            <option value="upi">UPI</option><option value="bank">Bank transfer</option><option value="cash">Cash</option><option value="other">Other</option>
          </select>
        </div>
        <div>
          <label htmlFor="r-ref" className={labelCls}>UTR / reference</label>
          <input id="r-ref" maxLength={60} value={form.reference} onChange={e => set('reference', e.target.value)} className={inputCls} />
        </div>
      </div>
      <FormError message={error} />
      <div className="flex justify-end gap-3">
        <button type="button" onClick={onCancel} disabled={busy} className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap h-9 px-3.5 text-sm rounded-md border border-slate-200 bg-white font-medium text-slate-700 shadow-xs transition-colors hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50">Cancel</button>
        <button type="submit" disabled={busy} className="px-5 py-2.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl disabled:opacity-60">{busy ? 'Closing…' : 'Record refund & close'}</button>
      </div>
    </form>
  )
}

export default function DepositsPage() {
  const { tenants, selectedPropertyId, reload } = useAppData()
  const { can } = useAuth()
  const { showToast } = useToast()
  const canManage = can('deposits.manage')
  const canApprove = can('deposits.approve')
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(null)
  const [refunding, setRefunding] = useState(null)
  const [confirm, setConfirm] = useState(null) // { settlement, action }
  const [startFor, setStartFor] = useState('')

  const load = useCallback(() => api.get('/deposits').then(setData).catch(e => setError(e.message)), [])
  useEffect(() => { load() }, [load])

  const inScope = useCallback(r => selectedPropertyId === 'all' || r.propertyId === selectedPropertyId, [selectedPropertyId])
  const settlements = useMemo(() => (data?.settlements ?? []).filter(inScope), [data, inScope])
  const start = useAsyncAction(async tenantId => {
    const s = await api.post('/settlements', { tenantId })
    await load()
    setEditing(s)
  })

  if (!data) return <div className="flex justify-center py-24">{error ? <div className="max-w-sm w-full px-4"><FormError message={error} /></div> : <Spinner size={26} />}</div>
  const startable = tenants.filter(t => t.status === 'active' && t.depositAmount > 0 && !settlements.some(s => s.tenantId === t.id && s.status !== 'closed'))

  const CONFIRM_TEXT = {
    submit: ['Send to the owner for approval?', 'The owner approves it before the tenant sees it.', 'Send for approval'],
    approve: ['Approve and share with the tenant?', 'They can accept or dispute it in the app. Record the refund once you have paid it.', 'Approve & share'],
    cancel: ['Cancel this settlement?', 'You can start a new one later.', 'Cancel settlement'],
  }

  const onNotice = data.onNotice.filter(inScope)
  const awaiting = data.awaitingSettlement.filter(inScope)
  const leaving = [
    ...onNotice.map(t => ({ ...t, when: `Moving out ${t.expectedMoveOut ? formatDate(t.expectedMoveOut) : 'soon'}` })),
    ...awaiting.map(t => ({ ...t, when: `Moved out ${formatDate(t.moveOutDate)}` })),
  ]
  const sm = { neutral: button('secondary', 'sm'), primary: button('primary', 'sm'), ghost: button('ghost', 'sm') }

  return (
    <div className={`${page} mx-auto max-w-5xl space-y-6`}>
      <PageHeader title="Deposits" description="Deposits held, tenants on notice, and move-out settlements." />

      <StatStrip items={[
        { label: 'Deposits held', value: formatCurrency(data.held), sub: `${data.tenantsWithDeposit} current tenants` },
        { label: 'On notice', value: onNotice.length, sub: 'Moving out soon' },
        { label: 'Open settlements', value: settlements.filter(x => x.status !== 'closed').length, sub: `${awaiting.length} moved out without one`, tone: awaiting.length ? 'warning' : 'default' },
      ]} />

      {leaving.length > 0 && (
        <Panel title="Leaving or left" count={leaving.length}>
          <ul className="divide-y divide-slate-100">
            {leaving.map(t => (
              <li key={t.id} className="flex items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-900">{t.name} <span className="font-normal text-slate-500">· Room {t.room}</span></p>
                  <p className="text-xs text-slate-500">{t.when} · deposit {formatCurrency(t.deposit)}</p>
                </div>
                {t.hasSettlement ? <span className="text-xs text-slate-500">Settlement in progress</span> : canManage && (
                  <button onClick={() => start.run(t.id)} disabled={start.busy} className={sm.neutral}>Start settlement</button>
                )}
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <Panel
        title="Settlements"
        count={settlements.length}
        actions={canManage && startable.length > 0 && (
          <div className="flex gap-2">
            <select aria-label="Tenant" value={startFor} onChange={e => setStartFor(e.target.value)} className="h-8 max-w-[200px] rounded-md border border-slate-200 bg-white px-2 text-[13px] text-slate-700 focus:border-indigo-500 focus:outline-none">
              <option value="">Settle another tenant…</option>
              {startable.map(t => <option key={t.id} value={t.id}>{t.name} · {t.room}</option>)}
            </select>
            <button onClick={() => startFor && start.run(startFor)} disabled={!startFor || start.busy} className={sm.neutral}>Start</button>
          </div>
        )}
      >
        {start.error && <div className="px-5 pt-3"><FormError message={start.error} /></div>}
        {settlements.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-slate-500">No settlements yet. Start one when a tenant gives notice or moves out.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {settlements.map(s => {
              const [label, tone] = STATUS[s.status] ?? STATUS.draft
              const editable = canManage && ['draft', 'pending_approval', 'shared', 'disputed'].includes(s.status)
              return (
                <li key={s.id} className="px-5 py-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium text-slate-900">{s.tenantName} <span className="font-normal text-slate-500">· Room {s.room} · {formatDate(s.moveOutDate)}</span></p>
                        <Badge tone={tone}>{label}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        Deposit {formatCurrency(s.deposit)} − dues {formatCurrency(sum(s.unpaidDues))} − deductions {formatCurrency(sum(s.deductions))} = <strong className="font-medium text-slate-900">{s.refundAmount >= 0 ? `refund ${formatCurrency(s.refundAmount)}` : `tenant owes ${formatCurrency(-s.refundAmount)}`}</strong>
                      </p>
                      {s.tenantResponse?.comment && <p className="mt-1 border-l-2 border-red-300 pl-2 text-xs text-slate-700">Tenant: “{s.tenantResponse.comment}”</p>}
                      {s.refund && <p className="mt-1 text-xs text-slate-500">Refunded {formatCurrency(s.refund.amount)} by {s.refund.method}{s.refund.reference ? ` (${s.refund.reference})` : ''} on {formatDate(s.refund.date)}</p>}
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-1.5">
                      {['draft', 'pending_approval'].includes(s.status) && canManage && <button onClick={() => setConfirm({ settlement: s, action: 'cancel' })} className={sm.ghost}>Cancel</button>}
                      {editable && <button onClick={() => setEditing(s)} className={sm.neutral}>Edit</button>}
                      {s.status === 'draft' && canManage && !canApprove && <button onClick={() => setConfirm({ settlement: s, action: 'submit' })} className={sm.primary}>Send for approval</button>}
                      {['draft', 'pending_approval'].includes(s.status) && canApprove && <button onClick={() => setConfirm({ settlement: s, action: 'approve' })} className={sm.primary}>Approve & share</button>}
                      {['shared', 'accepted', 'disputed'].includes(s.status) && canApprove && <button onClick={() => setRefunding(s)} className={sm.primary}>Record refund & close</button>}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Panel>

      <Modal isOpen={!!editing} onClose={() => setEditing(null)} title="Deposit settlement" description={editing?.tenantName} maxWidth="max-w-xl">
        {editing && <SettlementEditor settlement={editing} onCancel={() => setEditing(null)} onSave={async body => { await api.put(`/settlements/${editing.id}`, body); setEditing(null); showToast('Settlement saved.'); load() }} />}
      </Modal>
      <Modal isOpen={!!refunding} onClose={() => setRefunding(null)} title="Close settlement" description={refunding?.tenantName} maxWidth="max-w-lg">
        {refunding && <RefundForm settlement={refunding} onCancel={() => setRefunding(null)} onSubmit={async body => { await api.post(`/settlements/${refunding.id}`, { action: 'refund', ...body }); setRefunding(null); showToast('Settlement closed. Dues settled from the deposit.'); await load(); await reload() }} />}
      </Modal>
      <ConfirmDialog
        isOpen={!!confirm}
        tone={confirm?.action === 'cancel' ? 'danger' : 'primary'}
        title={CONFIRM_TEXT[confirm?.action]?.[0] ?? ''}
        message={CONFIRM_TEXT[confirm?.action]?.[1] ?? ''}
        confirmLabel={CONFIRM_TEXT[confirm?.action]?.[2] ?? 'Confirm'}
        onConfirm={async () => { await api.post(`/settlements/${confirm.settlement.id}`, { action: confirm.action }); setConfirm(null); showToast('Done.'); load() }}
        onCancel={() => setConfirm(null)}
      />
    </div>
  )
}
