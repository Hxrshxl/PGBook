'use client'
import { useMemo, useState } from 'react'
import { Plus, Wallet } from 'lucide-react'
import { useAppData } from '@/context/AppContext'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { useAsyncAction } from '@/hooks/useAsyncAction'
import {
  EXPENSE_CATEGORIES, EXPENSE_CATEGORY_LABELS, PAYMENT_METHOD_LABELS,
  formatCurrency, formatCurrencyRounded, formatDate, getCurrentMonth, receivedInMonth, roundMoney, todayISO,
} from '@/utils/helpers'
import Modal from '@/components/ui/Modal'
import MonthSelector from '@/components/ui/MonthSelector'
import EmptyState from '@/components/ui/EmptyState'
import PageHeader from '@/components/ui/PageHeader'
import StatStrip from '@/components/ui/StatStrip'
import Panel from '@/components/ui/Panel'
import RowMenu from '@/components/ui/RowMenu'
import { btn, page } from '@/components/ui/styles'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import FormError from '@/components/ui/FormError'

const inputCls = 'w-full border border-slate-200 rounded-md px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 transition-colors bg-white'
const labelCls = 'block text-[13px] font-medium text-slate-700 mb-1.5'

function ExpenseForm({ initialData, properties, defaultPropertyId, onSubmit, onCancel }) {
  const [form, setForm] = useState(() => ({
    propertyId: initialData?.propertyId ?? defaultPropertyId ?? properties[0]?.id ?? '',
    date: initialData?.date ?? todayISO(),
    category: initialData?.category ?? 'groceries',
    amount: initialData ? String(initialData.amount) : '',
    paidTo: initialData?.paidTo ?? '',
    method: initialData?.method ?? 'upi',
    note: initialData?.note ?? '',
  }))
  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }))
  const { run, busy, error } = useAsyncAction(onSubmit)

  function handleSubmit(e) {
    e.preventDefault()
    run({ ...form, amount: Number(form.amount), paidTo: form.paidTo.trim(), note: form.note.trim() })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {!initialData && properties.length > 1 && (
        <div>
          <label htmlFor="e-prop" className={labelCls}>Property *</label>
          <select id="e-prop" required value={form.propertyId} onChange={e => set('propertyId', e.target.value)} className={inputCls}>
            {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      )}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="e-amount" className={labelCls}>Amount *</label>
          <input id="e-amount" required type="number" min="0.01" step="0.01" inputMode="decimal" value={form.amount} onChange={e => set('amount', e.target.value)} placeholder="2500" className={inputCls} />
        </div>
        <div>
          <label htmlFor="e-date" className={labelCls}>Date *</label>
          <input id="e-date" required type="date" max={todayISO()} value={form.date} onChange={e => set('date', e.target.value)} className={inputCls} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="e-cat" className={labelCls}>Category</label>
          <select id="e-cat" value={form.category} onChange={e => set('category', e.target.value)} className={inputCls}>
            {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{EXPENSE_CATEGORY_LABELS[c]}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="e-method" className={labelCls}>Paid by</label>
          <select id="e-method" value={form.method} onChange={e => set('method', e.target.value)} className={inputCls}>
            {Object.entries(PAYMENT_METHOD_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label htmlFor="e-to" className={labelCls}>Paid to</label>
        <input id="e-to" maxLength={100} value={form.paidTo} onChange={e => set('paidTo', e.target.value)} placeholder="e.g. Ramesh (cook), BESCOM, Sharma Kirana" className={inputCls} />
      </div>
      <div>
        <label htmlFor="e-note" className={labelCls}>Note</label>
        <input id="e-note" maxLength={300} value={form.note} onChange={e => set('note', e.target.value)} placeholder="Optional" className={inputCls} />
      </div>
      <FormError message={error} />
      <div className="flex justify-end gap-3 pt-1">
        <button type="button" onClick={onCancel} disabled={busy} className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap h-9 px-3.5 text-sm rounded-md border border-slate-200 bg-white font-medium text-slate-700 shadow-xs transition-colors hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50">Cancel</button>
        <button type="submit" disabled={busy} className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap h-9 px-3.5 text-sm rounded-md bg-indigo-600 font-medium text-white shadow-xs transition-colors hover:bg-indigo-700 disabled:opacity-50">
          {busy ? 'Saving…' : initialData ? 'Save changes' : 'Add expense'}
        </button>
      </div>
    </form>
  )
}

export default function ExpensesPage() {
  const { expenses, payments, properties, propertyById, currentProperty, selectedPropertyId, addExpense, updateExpense, deleteExpense } = useAppData()
  const { can } = useAuth()
  const { showToast } = useToast()
  const canManage = can('expenses.manage')
  const [month, setMonth] = useState(getCurrentMonth())
  const [category, setCategory] = useState('all')
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)

  const monthExpenses = useMemo(() => expenses.filter(e => e.month === month), [expenses, month])
  const spent = roundMoney(monthExpenses.reduce((s, e) => s + e.amount, 0))
  const received = receivedInMonth(payments, month)
  const profit = roundMoney(received - spent)

  const byCategory = useMemo(() => {
    const totals = new Map()
    for (const e of monthExpenses) totals.set(e.category, (totals.get(e.category) ?? 0) + e.amount)
    return [...totals.entries()].map(([key, amount]) => ({ key, amount: roundMoney(amount) })).sort((a, b) => b.amount - a.amount)
  }, [monthExpenses])

  const list = category === 'all' ? monthExpenses : monthExpenses.filter(e => e.category === category)
  const showProperty = !currentProperty && properties.length > 1

  async function handleAdd(data) {
    await addExpense(data)
    setAdding(false)
    if (data.date.slice(0, 7) !== month) setMonth(data.date.slice(0, 7))
    showToast('Expense added.')
  }
  async function handleEdit(data) {
    const { propertyId: _ignored, ...changes } = data
    await updateExpense(editing.id, changes)
    setEditing(null)
    showToast('Expense updated.')
  }
  async function handleDelete() {
    await deleteExpense(deleting.id)
    showToast('Expense deleted.', 'warning')
    setDeleting(null)
  }

  const menuFor = e => [
    { label: 'Edit', onClick: () => setEditing(e) },
    { label: 'Delete', onClick: () => setDeleting(e), danger: true },
  ]

  return (
    <div className={`${page} mx-auto max-w-6xl`}>
      <PageHeader
        title="Expenses"
        description={`What it costs to run ${currentProperty?.name ?? (properties.length > 1 ? 'your properties' : 'your PG')}, and what is left over.`}
        actions={<>
          <MonthSelector value={month} onChange={setMonth} />
          {canManage && <button onClick={() => setAdding(true)} className={btn.primary}><Plus size={15} /> Add expense</button>}
        </>}
      />

      <StatStrip className="mb-6" items={[
        { label: 'Received', value: formatCurrencyRounded(received), sub: 'Rent and charges this month' },
        { label: 'Spent', value: formatCurrencyRounded(spent), sub: `${monthExpenses.length} expense${monthExpenses.length === 1 ? '' : 's'}` },
        { label: profit >= 0 ? 'Profit' : 'Loss', value: `${profit < 0 ? '−' : ''}${formatCurrencyRounded(Math.abs(profit))}`, tone: profit < 0 ? 'negative' : 'default', sub: received > 0 ? `${Math.round((profit / received) * 100)}% margin` : 'Nothing received yet' },
      ]} />

      {monthExpenses.length === 0 ? (
        <EmptyState icon={Wallet}
          title="No expenses this month"
          message={canManage ? 'Record salaries, groceries, repairs and bills to see your real profit.' : 'Expenses recorded for this month appear here.'}
          actionLabel={canManage ? 'Add expense' : undefined} onAction={() => setAdding(true)} />
      ) : (
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
          <Panel
            className="lg:col-span-2"
            title={category === 'all' ? 'All expenses' : EXPENSE_CATEGORY_LABELS[category]}
            count={list.length}
            actions={category !== 'all' && <button onClick={() => setCategory('all')} className="text-xs font-medium text-slate-600 hover:text-slate-900">Show all</button>}
          >
            <ul className="divide-y divide-slate-100">
              {list.map(e => (
                <li key={e.id} className="flex items-center gap-4 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">{e.paidTo || EXPENSE_CATEGORY_LABELS[e.category]}</p>
                    <p className="truncate text-xs text-slate-500">
                      {[formatDate(e.date), EXPENSE_CATEGORY_LABELS[e.category], PAYMENT_METHOD_LABELS[e.method], showProperty && propertyById.get(e.propertyId)?.name, e.note].filter(Boolean).join(' · ')}
                    </p>
                    {e.recordedBy?.name && <p className="text-[11px] text-slate-400">Recorded by {e.recordedBy.name}</p>}
                  </div>
                  <span className="shrink-0 text-sm font-medium tabular-nums text-slate-900">{formatCurrency(e.amount)}</span>
                  {canManage && <RowMenu items={menuFor(e)} label={`Actions for ${e.paidTo || 'expense'}`} />}
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="By category" description="Select a category to filter the list." bodyClassName="p-2">
            {byCategory.map(c => {
              const active = category === c.key
              return (
                <button key={c.key} onClick={() => setCategory(active ? 'all' : c.key)} aria-pressed={active}
                  className={`block w-full rounded-md px-3 py-2 text-left transition-colors ${active ? 'bg-indigo-50' : 'hover:bg-slate-50'}`}>
                  <span className="flex items-center justify-between gap-3 text-sm">
                    <span className={active ? 'font-medium text-indigo-700' : 'text-slate-700'}>{EXPENSE_CATEGORY_LABELS[c.key] ?? c.key}</span>
                    <span className="tabular-nums text-slate-900">{formatCurrencyRounded(c.amount)}</span>
                  </span>
                  <span className="mt-1.5 flex items-center gap-2">
                    <span className="h-1 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <span className={`block h-full rounded-full ${active ? 'bg-indigo-600' : 'bg-slate-400'}`} style={{ width: `${Math.max(2, (c.amount / byCategory[0].amount) * 100)}%` }} />
                    </span>
                    <span className="w-8 text-right text-[11px] tabular-nums text-slate-500">{Math.round((c.amount / spent) * 100)}%</span>
                  </span>
                </button>
              )
            })}
          </Panel>
        </div>
      )}

      <Modal isOpen={adding} onClose={() => setAdding(false)} title="Add expense">
        {adding && <ExpenseForm properties={properties} defaultPropertyId={selectedPropertyId !== 'all' ? selectedPropertyId : undefined} onSubmit={handleAdd} onCancel={() => setAdding(false)} />}
      </Modal>
      <Modal isOpen={!!editing} onClose={() => setEditing(null)} title="Edit expense">
        {editing && <ExpenseForm initialData={editing} properties={properties} onSubmit={handleEdit} onCancel={() => setEditing(null)} />}
      </Modal>
      <ConfirmDialog
        isOpen={!!deleting}
        title="Delete this expense?"
        message={deleting ? `${formatCurrency(deleting.amount)} · ${EXPENSE_CATEGORY_LABELS[deleting.category]} on ${formatDate(deleting.date)}. The deletion is recorded in the activity log.` : ''}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  )
}
