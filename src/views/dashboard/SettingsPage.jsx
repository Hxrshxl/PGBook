'use client'
import { useState } from 'react'
import { useAppData } from '@/context/AppContext'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { useAsyncAction } from '@/hooks/useAsyncAction'
import FormError from '@/components/ui/FormError'
import { PLANS } from '@/lib/plans'
import { formatDate } from '@/utils/helpers'

const FIELD_GROUPS = [
  {
    title: 'PG Details',
    fields: [
      { key: 'pgName',    label: 'PG name',     placeholder: 'Sunrise PG', required: true, maxLength: 100 },
      { key: 'address',   label: 'Address',     placeholder: '42, 3rd Cross, Koramangala, Bengaluru', maxLength: 300 },
      { key: 'totalBeds', label: 'Total beds',  placeholder: '24', type: 'number', min: 0, max: 10000,
        help: 'Used to calculate occupancy in Analytics.' },
    ],
  },
  {
    title: 'Owner Details',
    fields: [
      { key: 'ownerName', label: 'Owner name', placeholder: 'Your full name', maxLength: 100, help: 'Printed on receipts.' },
      { key: 'phone',     label: 'Phone',      placeholder: '9876543210', type: 'tel', maxLength: 20 },
    ],
  },
  {
    title: 'Rent & Payments',
    fields: [
      { key: 'upiId',      label: 'UPI ID',          placeholder: 'yourpg@upi', maxLength: 100, help: 'Included in WhatsApp reminders and receipts.' },
      { key: 'rentDueDay', label: 'Rent due day',    placeholder: '5', type: 'number', min: 1, max: 28, help: 'Day of the month rent is due (1–28). Shown in reminders.' },
      { key: 'logoText',   label: 'Receipt heading', placeholder: 'Sunrise PG', maxLength: 100, help: 'Defaults to your PG name.' },
    ],
  },
]
const NUMERIC = new Set(['totalBeds', 'rentDueDay'])

const inputCls = 'w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition-colors'
const cardCls = 'bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden'
const headCls = 'px-6 py-4 border-b border-slate-100 bg-slate-50'

function toForm(pgSettings) {
  return Object.fromEntries(FIELD_GROUPS.flatMap(g => g.fields).map(f => [f.key, String(pgSettings[f.key] ?? '')]))
}

function PgSettingsForm() {
  const { pgSettings, updateSettings } = useAppData()
  const { showToast } = useToast()
  const [form, setForm] = useState(() => toForm(pgSettings))
  const saved = toForm(pgSettings)
  const changed = Object.keys(form).filter(k => form[k] !== saved[k])

  const { run, busy, error } = useAsyncAction(async () => {
    const updates = Object.fromEntries(changed.map(k => [k, NUMERIC.has(k) ? Number(form[k] || 0) : form[k].trim()]))
    const result = await updateSettings(updates)
    setForm(toForm(result))
    showToast('Settings saved.')
  })

  return (
    <form onSubmit={e => { e.preventDefault(); run() }} className="space-y-6">
      {FIELD_GROUPS.map(group => (
        <div key={group.title} className={cardCls}>
          <div className={headCls}><h2 className="font-semibold text-slate-900 text-sm">{group.title}</h2></div>
          <div className="p-6 space-y-4">
            {group.fields.map(f => (
              <div key={f.key}>
                <label htmlFor={`s-${f.key}`} className="block text-slate-700 text-sm font-medium mb-1.5">{f.label}{f.required && ' *'}</label>
                <input id={`s-${f.key}`} type={f.type ?? 'text'} required={f.required} min={f.min} max={f.max} maxLength={f.maxLength}
                  value={form[f.key]} onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                  placeholder={f.placeholder} className={inputCls} />
                {f.help && <p className="text-xs text-slate-400 mt-1">{f.help}</p>}
              </div>
            ))}
          </div>
        </div>
      ))}

      <FormError message={error} />

      <div className="flex items-center justify-end gap-3">
        <button type="button" disabled={!changed.length || busy} onClick={() => setForm(saved)} className="px-5 py-2.5 text-sm font-medium text-slate-600 border border-slate-200 rounded-xl hover:border-slate-300 transition-colors disabled:opacity-50">
          Discard changes
        </button>
        <button type="submit" disabled={!changed.length || busy} className="px-6 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-colors disabled:opacity-50">
          {busy ? 'Saving…' : 'Save settings'}
        </button>
      </div>
    </form>
  )
}

function AccountForm() {
  const { user, updateProfile } = useAuth()
  const { showToast } = useToast()
  const [name, setName] = useState(user?.name ?? '')
  const { run, busy, error } = useAsyncAction(async () => {
    await updateProfile({ name })
    showToast('Profile updated.')
  })

  return (
    <form onSubmit={e => { e.preventDefault(); run() }} className={cardCls}>
      <div className={headCls}><h2 className="font-semibold text-slate-900 text-sm">Account</h2></div>
      <div className="p-6 space-y-4">
        <div>
          <label htmlFor="acc-name" className="block text-slate-700 text-sm font-medium mb-1.5">Your name</label>
          <input id="acc-name" required maxLength={100} value={name} onChange={e => setName(e.target.value)} className={inputCls} />
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-500">Email</span>
          <span className="font-medium text-slate-900">{user?.email}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-500">Plan</span>
          <span className="font-medium text-slate-900">
            {user?.plan === 'trial' ? `Free trial · ends ${formatDate(user.trialEndsAt)}` : PLANS[user?.plan]?.label ?? '—'}
          </span>
        </div>
        <FormError message={error} />
        <div className="flex justify-end">
          <button type="submit" disabled={busy || !name.trim() || name.trim() === user?.name} className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl disabled:opacity-50">
            {busy ? 'Saving…' : 'Update name'}
          </button>
        </div>
      </div>
    </form>
  )
}

function PasswordForm() {
  const { changePassword } = useAuth()
  const { showToast } = useToast()
  const [form, setForm] = useState({ current: '', next: '', confirm: '' })
  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }))
  const { run, busy, error, setError } = useAsyncAction(async () => {
    await changePassword(form.current, form.next)
    setForm({ current: '', next: '', confirm: '' })
    showToast('Password changed. Other devices have been signed out.')
  })

  function handleSubmit(e) {
    e.preventDefault()
    if (form.next.length < 8) return setError('New password must be at least 8 characters.')
    if (form.next !== form.confirm) return setError('New passwords do not match.')
    run()
  }

  return (
    <form onSubmit={handleSubmit} className={cardCls}>
      <div className={headCls}><h2 className="font-semibold text-slate-900 text-sm">Change password</h2></div>
      <div className="p-6 space-y-4">
        <div>
          <label htmlFor="pw-current" className="block text-slate-700 text-sm font-medium mb-1.5">Current password</label>
          <input id="pw-current" type="password" autoComplete="current-password" required value={form.current} onChange={e => set('current', e.target.value)} className={inputCls} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="pw-new" className="block text-slate-700 text-sm font-medium mb-1.5">New password</label>
            <input id="pw-new" type="password" autoComplete="new-password" required minLength={8} value={form.next} onChange={e => set('next', e.target.value)} className={inputCls} />
          </div>
          <div>
            <label htmlFor="pw-confirm" className="block text-slate-700 text-sm font-medium mb-1.5">Confirm new password</label>
            <input id="pw-confirm" type="password" autoComplete="new-password" required minLength={8} value={form.confirm} onChange={e => set('confirm', e.target.value)} className={inputCls} />
          </div>
        </div>
        <FormError message={error} />
        <div className="flex justify-end">
          <button type="submit" disabled={busy} className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl disabled:opacity-50">
            {busy ? 'Changing…' : 'Change password'}
          </button>
        </div>
      </div>
    </form>
  )
}

export default function SettingsPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-2xl mx-auto space-y-6">
      <div className="mb-2">
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-slate-500 text-sm mt-1">Your PG details, payment settings, and account</p>
      </div>
      <PgSettingsForm />
      <AccountForm />
      <PasswordForm />
    </div>
  )
}
