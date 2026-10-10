'use client'
import { useMemo, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { chargesTotal, formatCurrency, todayISO } from '@/utils/helpers'
import { useAsyncAction } from '@/hooks/useAsyncAction'
import { useAppData } from '@/context/AppContext'
import { useAuth } from '@/context/AuthContext'
import FormError from '@/components/ui/FormError'

const CHARGE_PRESETS = ['Food', 'Laundry', 'WiFi', 'Parking', 'Electricity']
const NEW_ROOM = '__new'

const ID_TYPES = [
  { value: 'aadhaar',  label: 'Aadhaar Card'     },
  { value: 'pan',      label: 'PAN Card'         },
  { value: 'passport', label: 'Passport'         },
  { value: 'dl',       label: "Driver's License" },
  { value: 'voter',    label: 'Voter ID'         },
  { value: 'other',    label: 'Other'            },
]

function initialForm(initialData, defaultPropertyId) {
  const base = {
    name: '', phone: '', email: '', propertyId: defaultPropertyId ?? '', roomId: '', room: '', rentAmount: '', depositAmount: '',
    moveInDate: todayISO(), idType: 'aadhaar', idNumber: '', notes: '',
    emergencyContact: { name: '', phone: '', relation: '' },
    recurringCharges: [],
  }
  if (!initialData) return base
  return {
    ...base,
    ...Object.fromEntries(Object.keys(base).map(k => [k, initialData[k] ?? base[k]])),
    room: initialData.roomId ? '' : initialData.room ?? '',
    roomId: initialData.roomId ?? '',
    rentAmount: String(initialData.rentAmount ?? ''),
    depositAmount: initialData.depositAmount ? String(initialData.depositAmount) : '',
    emergencyContact: { ...base.emergencyContact, ...initialData.emergencyContact },
    recurringCharges: (initialData.recurringCharges ?? []).map(c => ({ label: c.label, amount: String(c.amount) })),
  }
}

// onSubmit should throw on failure; the error is shown inside the form.
export default function TenantForm({ initialData, onSubmit, onCancel }) {
  const { properties, allRooms, allTenants, selectedPropertyId } = useAppData()
  const { can } = useAuth()
  const canSeeKyc = can('tenants.kyc')
  const defaultPropertyId = selectedPropertyId !== 'all' ? selectedPropertyId : properties[0]?.id
  const [form, setForm] = useState(() => initialForm(initialData, defaultPropertyId))
  const { run, busy, error } = useAsyncAction(onSubmit)

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }))
  const setEC = (k, v) => setForm(prev => ({ ...prev, emergencyContact: { ...prev.emergencyContact, [k]: v } }))
  const setCharge = (i, k, v) => setForm(prev => ({ ...prev, recurringCharges: prev.recurringCharges.map((c, j) => (j === i ? { ...c, [k]: v } : c)) }))
  const addCharge = label => setForm(prev => ({ ...prev, recurringCharges: [...prev.recurringCharges, { label, amount: '' }] }))
  const removeCharge = i => setForm(prev => ({ ...prev, recurringCharges: prev.recurringCharges.filter((_, j) => j !== i) }))

  // Rooms of the chosen property with how many beds are free (the tenant's own bed counts as free).
  const roomOptions = useMemo(() => {
    const occupied = new Map()
    for (const t of allTenants) if (t.status === 'active' && t.roomId && t.id !== initialData?.id) occupied.set(t.roomId, (occupied.get(t.roomId) ?? 0) + 1)
    return allRooms
      .filter(r => r.propertyId === form.propertyId)
      .map(r => ({ ...r, free: r.capacity - (occupied.get(r.id) ?? 0) }))
  }, [allRooms, allTenants, form.propertyId, initialData?.id])
  const chosenRoom = roomOptions.find(r => r.id === form.roomId)
  const usedLabels = new Set(form.recurringCharges.map(c => c.label.trim().toLowerCase()))
  const monthlyTotal = (Number(form.rentAmount) || 0) + chargesTotal(form.recurringCharges)

  function chooseProperty(id) {
    setForm(prev => ({ ...prev, propertyId: id, roomId: '', room: '' }))
  }
  function chooseRoom(id) {
    const room = roomOptions.find(r => r.id === id)
    setForm(prev => ({ ...prev, roomId: id, rentAmount: prev.rentAmount || (room?.rent ? String(room.rent) : '') }))
  }

  function handleSubmit(e) {
    e.preventDefault()
    const { roomId, room, idType, idNumber, ...rest } = form
    run({
      ...rest,
      ...(canSeeKyc ? { idType, idNumber } : {}),
      ...(roomId && roomId !== NEW_ROOM ? { roomId } : { room: room.trim() }),
      rentAmount: Number(form.rentAmount),
      depositAmount: Number(form.depositAmount) || 0,
      recurringCharges: form.recurringCharges.filter(c => c.label.trim()).map(c => ({ label: c.label.trim(), amount: Number(c.amount) || 0 })),
    })
  }

  const inputCls = 'w-full border border-slate-200 rounded-md px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 transition-colors bg-white'
  const labelCls = 'block text-[13px] font-medium text-slate-700 mb-1.5'

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="t-name" className={labelCls}>Full name *</label>
          <input id="t-name" required maxLength={100} value={form.name} onChange={e => set('name', e.target.value)} placeholder="Ravi Sharma" className={inputCls} />
        </div>
        <div>
          <label htmlFor="t-phone" className={labelCls}>Phone *</label>
          <input id="t-phone" required type="tel" inputMode="tel" minLength={10} maxLength={20} title="At least 10 digits"
            value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="9876543210" className={inputCls} />
        </div>
      </div>

      <div>
        <label htmlFor="t-email" className={labelCls}>Email <span className="text-slate-400 font-normal">(optional)</span></label>
        <input id="t-email" type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="ravi@example.com" className={inputCls} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {properties.length > 1 && (
          <div>
            <label htmlFor="t-prop" className={labelCls}>Property *</label>
            <select id="t-prop" required value={form.propertyId} onChange={e => chooseProperty(e.target.value)} className={inputCls}>
              {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        )}
        <div className={properties.length > 1 ? '' : 'sm:col-span-2'}>
          <label htmlFor="t-room" className={labelCls}>Room *</label>
          {roomOptions.length > 0 && (
            <select id="t-room" required value={form.roomId} onChange={e => chooseRoom(e.target.value)} className={inputCls}>
              <option value="" disabled>Choose a room…</option>
              {roomOptions.map(r => (
                <option key={r.id} value={r.id} disabled={r.free <= 0}>
                  {r.name} — {r.free <= 0 ? 'full' : `${r.free} of ${r.capacity} bed${r.capacity === 1 ? '' : 's'} free`}
                </option>
              ))}
              <option value={NEW_ROOM}>+ New room…</option>
            </select>
          )}
          {(roomOptions.length === 0 || form.roomId === NEW_ROOM) && (
            <input id={roomOptions.length ? 't-room-new' : 't-room'} aria-label="New room name" required maxLength={20} value={form.room} onChange={e => set('room', e.target.value)}
              placeholder="A-204" className={`${inputCls} ${roomOptions.length ? 'mt-2' : ''}`} />
          )}
          {form.roomId === NEW_ROOM || roomOptions.length === 0
            ? <p className="text-xs text-slate-400 mt-1">A new room is created with 1 bed. You can change its beds on the Rooms page.</p>
            : chosenRoom?.rent > 0 && <p className="text-xs text-slate-400 mt-1">Room rent: {formatCurrency(chosenRoom.rent)} per bed</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label htmlFor="t-rent" className={labelCls}>Monthly rent *</label>
          <input id="t-rent" required type="number" min="0" step="1" inputMode="numeric" value={form.rentAmount} onChange={e => set('rentAmount', e.target.value)} placeholder="10000" className={inputCls} />
        </div>
        <div>
          <label htmlFor="t-deposit" className={labelCls}>Deposit</label>
          <input id="t-deposit" type="number" min="0" step="1" inputMode="numeric" value={form.depositAmount} onChange={e => set('depositAmount', e.target.value)} placeholder="20000" className={inputCls} />
        </div>
        <div>
          <label htmlFor="t-movein" className={labelCls}>Move-in *</label>
          <input id="t-movein" required type="date" value={form.moveInDate} onChange={e => set('moveInDate', e.target.value)} className={inputCls} />
        </div>
      </div>

      {canSeeKyc && <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="t-idtype" className={labelCls}>ID type</label>
          <select id="t-idtype" value={form.idType} onChange={e => set('idType', e.target.value)} className={inputCls}>
            {ID_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="t-idnum" className={labelCls}>ID number</label>
          <input id="t-idnum" maxLength={50} value={form.idNumber} onChange={e => set('idNumber', e.target.value)} placeholder="XXXX-XXXX-1234" className={inputCls} />
        </div>
      </div>}

      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-slate-700 text-sm font-medium">Monthly charges <span className="text-slate-400 font-normal">(besides rent)</span></p>
          {(form.recurringCharges.length > 0 || Number(form.rentAmount) > 0) && (
            <p className="text-xs text-slate-500">Total per month: <span className="font-semibold text-slate-900">{formatCurrency(monthlyTotal)}</span></p>
          )}
        </div>
        {form.recurringCharges.map((c, i) => (
          <div key={i} className="flex gap-2 mb-2">
            <input aria-label="Charge name" required maxLength={40} value={c.label} onChange={e => setCharge(i, 'label', e.target.value)} placeholder="Food" className={inputCls} />
            <input aria-label={`${c.label || 'Charge'} amount`} required type="number" min="0" step="1" inputMode="numeric" value={c.amount} onChange={e => setCharge(i, 'amount', e.target.value)} placeholder="3000" className={`${inputCls} max-w-32`} />
            <button type="button" onClick={() => removeCharge(i)} aria-label={`Remove ${c.label || 'charge'}`} className="px-2 text-slate-400 hover:text-red-600"><X size={16} /></button>
          </div>
        ))}
        <div className="flex flex-wrap gap-2">
          {CHARGE_PRESETS.filter(l => !usedLabels.has(l.toLowerCase())).map(label => (
            <button key={label} type="button" onClick={() => addCharge(label)} className="flex items-center gap-1 text-xs font-medium text-slate-600 border border-dashed border-slate-300 hover:border-indigo-400 hover:text-indigo-600 rounded-lg px-2.5 py-1">
              <Plus size={12} /> {label}
            </button>
          ))}
          <button type="button" onClick={() => addCharge('')} className="flex items-center gap-1 text-xs font-medium text-slate-600 border border-dashed border-slate-300 hover:border-indigo-400 hover:text-indigo-600 rounded-lg px-2.5 py-1">
            <Plus size={12} /> Other
          </button>
        </div>
        <p className="text-xs text-slate-400 mt-1.5">Added to every month&apos;s dues. Changing them updates dues that have nothing paid yet.</p>
      </div>

      <div>
        <p className="text-slate-700 text-sm font-medium mb-2">Emergency contact</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input aria-label="Emergency contact name" maxLength={100} value={form.emergencyContact.name} onChange={e => setEC('name', e.target.value)} placeholder="Contact name" className={inputCls} />
          <input aria-label="Emergency contact phone" maxLength={20} value={form.emergencyContact.phone} onChange={e => setEC('phone', e.target.value)} placeholder="Phone" type="tel" className={inputCls} />
          <input aria-label="Emergency contact relation" maxLength={50} value={form.emergencyContact.relation} onChange={e => setEC('relation', e.target.value)} placeholder="Relation" className={inputCls} />
        </div>
      </div>

      <div>
        <label htmlFor="t-notes" className={labelCls}>Notes <span className="text-slate-400 font-normal">(optional)</span></label>
        <textarea id="t-notes" rows={2} maxLength={1000} value={form.notes} onChange={e => set('notes', e.target.value)}
          placeholder="e.g. Food preference, vehicle number, company" className={`${inputCls} resize-none`} />
      </div>

      <FormError message={error} />

      <div className="flex items-center justify-end gap-3 pt-2">
        <button type="button" onClick={onCancel} disabled={busy} className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap h-9 px-3.5 text-sm rounded-md border border-slate-200 bg-white font-medium text-slate-700 shadow-xs transition-colors hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50">
          Cancel
        </button>
        <button type="submit" disabled={busy} className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap h-9 px-3.5 text-sm rounded-md bg-indigo-600 font-medium text-white shadow-xs transition-colors hover:bg-indigo-700 disabled:opacity-50">
          {busy ? 'Saving…' : initialData ? 'Save changes' : 'Add tenant'}
        </button>
      </div>
    </form>
  )
}
