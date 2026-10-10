'use client'
import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useAppData } from '@/context/AppContext'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { useAsyncAction } from '@/hooks/useAsyncAction'
import FormError from '@/components/ui/FormError'
import Modal from '@/components/ui/Modal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import Badge from '@/components/ui/Badge'
import PageHeader from '@/components/ui/PageHeader'
import RowMenu from '@/components/ui/RowMenu'
import { btn, button, field, page } from '@/components/ui/styles'
import { PLANS } from '@/lib/plans'
import { formatCurrency, formatDate } from '@/utils/helpers'

const FIELD_GROUPS = [
  {
    title: 'Property details',
    fields: [
      { key: 'name',    label: 'PG name',  placeholder: 'Sunrise PG', required: true, maxLength: 100 },
      { key: 'address', label: 'Address',  placeholder: '42, 3rd Cross, Koramangala', maxLength: 300 },
      { key: 'city',    label: 'City',     placeholder: 'Bengaluru', maxLength: 60, half: true },
      { key: 'phone',   label: 'Phone',    placeholder: '9876543210', type: 'tel', maxLength: 20, half: true },
      { key: 'totalBeds', label: 'Total beds', placeholder: '24', type: 'number', min: 0, max: 10000, half: true,
        help: 'Only used until you set up rooms on the Rooms page.' },
    ],
  },
  {
    title: 'Receipts',
    fields: [
      { key: 'ownerName', label: 'Signed by', placeholder: 'Your full name', maxLength: 100, half: true, help: 'Printed on receipts.' },
      { key: 'logoText',  label: 'Receipt heading', placeholder: 'Sunrise PG', maxLength: 100, half: true, help: 'Defaults to the PG name.' },
      { key: 'gstin',     label: 'GSTIN', placeholder: '29ABCDE1234F1Z5', maxLength: 15, help: 'Optional. Shown on receipts when set.', upper: true },
    ],
  },
  {
    title: 'Rent rules',
    fields: [
      { key: 'upiId',            label: 'UPI ID for rent', placeholder: 'yourpg@upi', maxLength: 100, help: 'Included in reminders and receipts. Changes are recorded as a security event.' },
      { key: 'rentDueDay',       label: 'Rent due day', type: 'number', min: 1, max: 28, half: true, help: 'Day of the month (1–28).' },
      { key: 'noticePeriodDays', label: 'Notice period (days)', type: 'number', min: 0, max: 180, half: true },
    ],
  },
]
const FIELDS = FIELD_GROUPS.flatMap(g => g.fields)
const NUMERIC = new Set(['totalBeds', 'rentDueDay', 'noticePeriodDays'])
const LATE_DEFAULTS = { enabled: false, graceDays: 3, type: 'flat', amount: 0, maxAmount: 0 }

const inputCls = field.input
const labelCls = field.label
const cardCls = 'bg-white rounded-xl border border-slate-200 overflow-hidden'
const headCls = 'px-5 py-3.5 border-b border-slate-200'

function toForm(p) {
  const lateFee = { ...LATE_DEFAULTS, ...p.lateFee }
  return {
    ...Object.fromEntries(FIELDS.map(f => [f.key, String(p[f.key] ?? '')])),
    lateFee: { enabled: !!lateFee.enabled, graceDays: String(lateFee.graceDays), type: lateFee.type, amount: String(lateFee.amount), maxAmount: String(lateFee.maxAmount || '') },
  }
}

function fromForm(form) {
  return {
    ...Object.fromEntries(FIELDS.map(f => [f.key, NUMERIC.has(f.key) ? Number(form[f.key] || 0) : form[f.key].trim()])),
    lateFee: {
      enabled: form.lateFee.enabled, type: form.lateFee.type,
      graceDays: Number(form.lateFee.graceDays || 0), amount: Number(form.lateFee.amount || 0), maxAmount: Number(form.lateFee.maxAmount || 0),
    },
  }
}

function lateFeeExample(lf) {
  const amount = Number(lf.amount) || 0
  if (!lf.enabled || !amount) return 'No late fee is charged.'
  const after = `${Number(lf.graceDays) || 0} day(s) after the due date`
  if (lf.type === 'perDay') {
    const cap = Number(lf.maxAmount) ? `, up to ${formatCurrency(Number(lf.maxAmount))}` : ''
    return `${formatCurrency(amount)} per day starting ${after}${cap}.`
  }
  return `${formatCurrency(amount)} once, ${after}.`
}

function PropertyForm({ property, editable }) {
  const { updateProperty } = useAppData()
  const { showToast } = useToast()
  const [form, setForm] = useState(() => toForm(property))
  const saved = toForm(property)
  const dirty = JSON.stringify(form) !== JSON.stringify(saved)
  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }))
  const setLate = (k, v) => setForm(prev => ({ ...prev, lateFee: { ...prev.lateFee, [k]: v } }))

  const { run, busy, error } = useAsyncAction(async () => {
    const result = await updateProperty(property.id, fromForm(form))
    setForm(toForm(result))
    showToast('Settings saved.')
  })

  return (
    <form onSubmit={e => { e.preventDefault(); run() }} className="space-y-6">
      {FIELD_GROUPS.map(group => (
        <div key={group.title} className={cardCls}>
          <div className={headCls}><h2 className="text-sm font-semibold text-slate-900">{group.title}</h2></div>
          <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
            {group.fields.map(f => (
              <div key={f.key} className={f.half ? '' : 'sm:col-span-2'}>
                <label htmlFor={`s-${f.key}`} className={labelCls}>{f.label}{f.required && ' *'}</label>
                <input id={`s-${f.key}`} type={f.type ?? 'text'} required={f.required} min={f.min} max={f.max} maxLength={f.maxLength} disabled={!editable}
                  value={form[f.key]} onChange={e => set(f.key, f.upper ? e.target.value.toUpperCase() : e.target.value)}
                  placeholder={f.placeholder} className={inputCls} />
                {f.help && <p className={field.help}>{f.help}</p>}
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className={cardCls}>
        <div className={`${headCls} flex items-center justify-between`}>
          <h2 className="text-sm font-semibold text-slate-900">Late fee</h2>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={form.lateFee.enabled} disabled={!editable} onChange={e => setLate('enabled', e.target.checked)} className="accent-indigo-600 w-4 h-4" />
            Charge late fees
          </label>
        </div>
        <div className="space-y-4 p-5">
          {form.lateFee.enabled && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <label htmlFor="lf-type" className={labelCls}>Type</label>
                <select id="lf-type" value={form.lateFee.type} disabled={!editable} onChange={e => setLate('type', e.target.value)} className={inputCls}>
                  <option value="flat">One-time</option>
                  <option value="perDay">Per day</option>
                </select>
              </div>
              <div>
                <label htmlFor="lf-amount" className={labelCls}>Amount</label>
                <input id="lf-amount" type="number" min={0} max={100000} step={1} disabled={!editable} value={form.lateFee.amount} onChange={e => setLate('amount', e.target.value)} className={inputCls} />
              </div>
              <div>
                <label htmlFor="lf-grace" className={labelCls}>Grace days</label>
                <input id="lf-grace" type="number" min={0} max={27} step={1} disabled={!editable} value={form.lateFee.graceDays} onChange={e => setLate('graceDays', e.target.value)} className={inputCls} />
              </div>
              {form.lateFee.type === 'perDay' && (
                <div>
                  <label htmlFor="lf-max" className={labelCls}>Maximum</label>
                  <input id="lf-max" type="number" min={0} step={1} disabled={!editable} value={form.lateFee.maxAmount} onChange={e => setLate('maxAmount', e.target.value)} placeholder="No cap" className={inputCls} />
                </div>
              )}
            </div>
          )}
          <p className="text-sm text-slate-600">{lateFeeExample(form.lateFee)}</p>
          <p className="text-xs text-slate-500">Late fees are added when you press “Apply late fees” on the Rent page. They show separately on the dues and receipt, and can be waived per tenant.</p>
        </div>
      </div>

      {editable && (
        <>
          <FormError message={error} />
          <div className="flex items-center justify-end gap-3">
            <button type="button" disabled={!dirty || busy} onClick={() => setForm(saved)} className={btn.secondary}>
              Discard changes
            </button>
            <button type="submit" disabled={!dirty || busy} className={btn.primary}>
              {busy ? 'Saving…' : 'Save settings'}
            </button>
          </div>
        </>
      )}
    </form>
  )
}

function AddPropertyForm({ onSubmit, onCancel }) {
  const [form, setForm] = useState({ name: '', address: '', city: '' })
  const { run, busy, error } = useAsyncAction(onSubmit)
  return (
    <form onSubmit={e => { e.preventDefault(); run({ name: form.name.trim(), address: form.address.trim(), city: form.city.trim() }) }} className="space-y-4">
      <div>
        <label htmlFor="np-name" className={labelCls}>PG name *</label>
        <input id="np-name" required maxLength={100} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Sunrise PG — Block B" className={inputCls} />
      </div>
      <div>
        <label htmlFor="np-address" className={labelCls}>Address</label>
        <input id="np-address" maxLength={300} value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} className={inputCls} />
      </div>
      <div>
        <label htmlFor="np-city" className={labelCls}>City</label>
        <input id="np-city" maxLength={60} value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} className={inputCls} />
      </div>
      <p className="text-xs text-slate-500">You can set its UPI ID, due day and late fee rules after adding it, then add rooms on the Rooms page.</p>
      <FormError message={error} />
      <div className="flex justify-end gap-3">
        <button type="button" onClick={onCancel} disabled={busy} className={btn.secondary}>Cancel</button>
        <button type="submit" disabled={busy} className={btn.primary}>{busy ? 'Adding…' : 'Add property'}</button>
      </div>
    </form>
  )
}

function PropertiesSection() {
  const { properties, addProperty, archiveProperty, selectProperty } = useAppData()
  const { can } = useAuth()
  const { showToast } = useToast()
  const canManageProperties = can('properties.manage')
  const editable = can('settings.manage')
  const [editingId, setEditingId] = useState(properties[0]?.id ?? null)
  const [adding, setAdding] = useState(false)
  const [archiving, setArchiving] = useState(null)
  const editing = properties.find(p => p.id === editingId) ?? properties[0]

  async function handleAdd(data) {
    const property = await addProperty(data)
    setAdding(false)
    setEditingId(property.id)
    showToast(`${property.name} added. Switch to it from the top bar.`)
  }
  async function handleArchive() {
    await archiveProperty(archiving.id)
    if (editingId === archiving.id) setEditingId(null)
    showToast(`${archiving.name} archived.`, 'warning')
    setArchiving(null)
  }

  if (!editing) return null
  return (
    <>
      {(properties.length > 1 || canManageProperties) && (
        <div className={cardCls}>
          <div className={`${headCls} flex items-center justify-between`}>
            <h2 className="text-sm font-semibold text-slate-900">Properties</h2>
            {canManageProperties && (
              <button onClick={() => setAdding(true)} className={button('secondary', 'sm')}><Plus size={14} /> Add property</button>
            )}
          </div>
          <ul className="divide-y divide-slate-100">
            {properties.map(p => {
              const current = p.id === editing.id
              return (
                <li key={p.id} className={`flex items-center gap-3 px-5 py-3 ${current ? 'bg-slate-50' : ''}`}>
                  <button onClick={() => setEditingId(p.id)} className="min-w-0 flex-1 text-left">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-slate-900">{p.name}</span>
                      {current && properties.length > 1 && <Badge tone="blue">Editing</Badge>}
                    </span>
                    <span className="block truncate text-xs text-slate-500">
                      {p.city && `${p.city} · `}{p.rooms} rooms · {p.occupiedBeds}/{p.beds} beds occupied
                    </span>
                  </button>
                  <RowMenu label={`Actions for ${p.name}`} items={[
                    { label: 'Edit settings', onClick: () => setEditingId(p.id) },
                    { label: 'Switch to this property', onClick: () => selectProperty(p.id) },
                    { divider: true },
                    { label: 'Archive property', onClick: () => setArchiving(p), danger: true, hidden: !canManageProperties || properties.length < 2 },
                  ]} />
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {properties.length > 1 && <h2 className="pt-2 text-sm font-semibold text-slate-900">Settings for {editing.name}</h2>}
      <PropertyForm key={editing.id} property={editing} editable={editable} />
      {!editable && <p className="-mt-3 text-xs text-slate-500">Only the owner can change property settings.</p>}

      <Modal isOpen={adding} onClose={() => setAdding(false)} title="Add property">
        {adding && <AddPropertyForm onSubmit={handleAdd} onCancel={() => setAdding(false)} />}
      </Modal>
      <ConfirmDialog
        isOpen={!!archiving}
        title={`Archive ${archiving?.name ?? ''}?`}
        message="It disappears from your lists and the property switcher. Past tenants, dues and receipts are kept. Only possible once nobody lives there."
        confirmLabel="Archive property"
        onConfirm={handleArchive}
        onCancel={() => setArchiving(null)}
      />
    </>
  )
}

function AccountForm() {
  const { user, access, updateProfile } = useAuth()
  const { showToast } = useToast()
  const [name, setName] = useState(user?.name ?? '')
  const { run, busy, error } = useAsyncAction(async () => {
    await updateProfile({ name })
    showToast('Profile updated.')
  })
  const org = access?.org
  const isOwner = access?.role === 'owner'

  return (
    <form onSubmit={e => { e.preventDefault(); run() }} className={cardCls}>
      <div className={headCls}><h2 className="text-sm font-semibold text-slate-900">Account</h2></div>
      <div className="space-y-4 p-5">
        <div>
          <label htmlFor="acc-name" className={labelCls}>Your name</label>
          <input id="acc-name" required maxLength={100} value={name} onChange={e => setName(e.target.value)} className={inputCls} />
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-500">Email</span>
          <span className="font-medium text-slate-900">{user?.email}</span>
        </div>
        {isOwner ? (
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500">Plan</span>
            <span className="font-medium text-slate-900">
              {org?.plan === 'trial' ? `Free trial · ends ${formatDate(String(org.trialEndsAt).slice(0, 10))}` : PLANS[org?.plan]?.label ?? org?.planLabel ?? '—'}
            </span>
          </div>
        ) : (
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500">Role</span>
            <span className="font-medium text-slate-900">{access?.roleLabel} · {org?.ownerName}</span>
          </div>
        )}
        <FormError message={error} />
        <div className="flex justify-end">
          <button type="submit" disabled={busy || !name.trim() || name.trim() === user?.name} className={btn.primary}>
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
      <div className={headCls}><h2 className="text-sm font-semibold text-slate-900">Change password</h2></div>
      <div className="space-y-4 p-5">
        <div>
          <label htmlFor="pw-current" className={labelCls}>Current password</label>
          <input id="pw-current" type="password" autoComplete="current-password" required value={form.current} onChange={e => set('current', e.target.value)} className={inputCls} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="pw-new" className={labelCls}>New password</label>
            <input id="pw-new" type="password" autoComplete="new-password" required minLength={8} value={form.next} onChange={e => set('next', e.target.value)} className={inputCls} />
          </div>
          <div>
            <label htmlFor="pw-confirm" className={labelCls}>Confirm new password</label>
            <input id="pw-confirm" type="password" autoComplete="new-password" required minLength={8} value={form.confirm} onChange={e => set('confirm', e.target.value)} className={inputCls} />
          </div>
        </div>
        <FormError message={error} />
        <div className="flex justify-end">
          <button type="submit" disabled={busy} className={btn.primary}>
            {busy ? 'Changing…' : 'Change password'}
          </button>
        </div>
      </div>
    </form>
  )
}

export default function SettingsPage() {
  const { can } = useAuth()
  return (
    <div className={`${page} mx-auto max-w-2xl space-y-6`}>
      <PageHeader title="Settings" description={can('settings.manage') ? 'Your properties, payment rules and account.' : 'Your account.'} />
      {can('settings.view') && <PropertiesSection />}
      <AccountForm />
      <PasswordForm />
    </div>
  )
}
