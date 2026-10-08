'use client'
import { useMemo, useState } from 'react'
import { Plus, Wallet, Pencil, Trash2, TrendingUp, TrendingDown } from 'lucide-react'
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
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import FormError from '@/components/ui/FormError'

const inputCls = 'w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition-colors'
const labelCls = 'block text-slate-700 text-sm font-medium mb-1.5'

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
        <button type="button" onClick={onCancel} disabled={busy} className="px-5 py-2.5 text-sm font-medium text-slate-600 border border-slate-200 rounded-xl hover:border-slate-300 disabled:opacity-50">Cancel</button>
        <button type="submit" disabled={busy} className="px-5 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl disabled:opacity-60">
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

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Expenses</h1>
          <p className="text-slate-500 text-sm mt-1">What it costs to run {currentProperty?.name ?? (properties.length > 1 ? 'your properties' : 'your PG')}, and what&apos;s left over</p>
        </div>
        <div className="flex items-center gap-3">
          <MonthSelector value={month} onChange={setMonth} />
          {canManage && (
            <button onClick={() => setAdding(true)} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm px-4 py-2.5 rounded-xl transition-colors shrink-0">
              <Plus size={16} /> <span className="hidden sm:inline">Add Expense</span><span className="sm:hidden">Add</span>
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Received</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{formatCurrencyRounded(received)}</p>
          <p className="text-xs text-slate-400 mt-1">Rent & charges received this month</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Spent</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{formatCurrencyRounded(spent)}</p>
          <p className="text-xs text-slate-400 mt-1">{monthExpenses.length} expense{monthExpenses.length === 1 ? '' : 's'}</p>
        </div>
        <div className={`rounded-2xl border shadow-sm p-5 ${profit >= 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
          <p className={`text-xs font-medium uppercase tracking-wide ${profit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{profit >= 0 ? 'Profit' : 'Loss'}</p>
          <p className={`text-2xl font-bold mt-1 flex items-center gap-2 ${profit >= 0 ? 'text-emerald-800' : 'text-red-800'}`}>
            {profit >= 0 ? <TrendingUp size={20} /> : <TrendingDown size={20} />}{formatCurrencyRounded(Math.abs(profit))}
          </p>
          <p className={`text-xs mt-1 ${profit >= 0 ? 'text-emerald-700/70' : 'text-red-700/70'}`}>{received > 0 ? `${Math.round((profit / received) * 100)}% margin` : 'Nothing received yet'}</p>
        </div>
      </div>

      {byCategory.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 mb-6">
          <h2 className="text-sm font-semibold text-slate-900 mb-4">Where the money went</h2>
          <div className="space-y-2.5">
            {byCategory.map(c => (
              <button key={c.key} onClick={() => setCategory(category === c.key ? 'all' : c.key)} className="w-full text-left group" aria-pressed={category === c.key}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className={`font-medium ${category === c.key ? 'text-indigo-700' : 'text-slate-700 group-hover:text-slate-900'}`}>{EXPENSE_CATEGORY_LABELS[c.key] ?? c.key}</span>
                  <span className="text-slate-600 tabular-nums">{formatCurrency(c.amount)} <span className="text-slate-400 text-xs">({Math.round((c.amount / spent) * 100)}%)</span></span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div className={`h-full rounded-full ${category === c.key ? 'bg-indigo-600' : 'bg-indigo-400'}`} style={{ width: `${Math.max(2, (c.amount / byCategory[0].amount) * 100)}%` }} />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {list.length === 0 ? (
        <EmptyState icon={Wallet}
          title={monthExpenses.length ? 'No expenses in this category' : 'No expenses this month'}
          message={canManage ? 'Record salaries, groceries, repairs and bills to see your real profit.' : 'Expenses recorded for this month appear here.'}
          actionLabel={canManage && !monthExpenses.length ? 'Add Expense' : undefined} onAction={() => setAdding(true)} />
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50">
            <h2 className="text-sm font-semibold text-slate-900">{category === 'all' ? 'All expenses' : EXPENSE_CATEGORY_LABELS[category]}</h2>
            {category !== 'all' && <button onClick={() => setCategory('all')} className="text-xs font-medium text-indigo-600 hover:text-indigo-500">Show all</button>}
          </div>
          <ul className="divide-y divide-slate-100">
            {list.map(e => (
              <li key={e.id} className="flex items-center gap-4 px-5 py-3.5">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{e.paidTo || EXPENSE_CATEGORY_LABELS[e.category]}</p>
                  <p className="text-xs text-slate-400 truncate">
                    {[formatDate(e.date), EXPENSE_CATEGORY_LABELS[e.category], PAYMENT_METHOD_LABELS[e.method], showProperty && propertyById.get(e.propertyId)?.name, e.note].filter(Boolean).join(' · ')}
                  </p>
                  {e.recordedBy?.name && <p className="text-[11px] text-slate-400">Recorded by {e.recordedBy.name}</p>}
                </div>
                <span className="text-sm font-semibold text-slate-900 tabular-nums shrink-0">{formatCurrency(e.amount)}</span>
                {canManage && (
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => setEditing(e)} aria-label="Edit expense" className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-50"><Pencil size={14} /></button>
                    <button onClick={() => setDeleting(e)} aria-label="Delete expense" className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-slate-50"><Trash2 size={14} /></button>
                  </div>
                )}
              </li>
            ))}
          </ul>
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
