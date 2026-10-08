'use client'
import { useMemo, useState } from 'react'
import { BedDouble, Pencil, Plus, Archive, Search } from 'lucide-react'
import { useAppData } from '@/context/AppContext'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { useAsyncAction } from '@/hooks/useAsyncAction'
import { formatCurrency } from '@/utils/helpers'
import Modal from '@/components/ui/Modal'
import EmptyState from '@/components/ui/EmptyState'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import FormError from '@/components/ui/FormError'

const inputCls = 'w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition-colors'
const labelCls = 'block text-slate-700 text-sm font-medium mb-1.5'

const FILTERS = [
  { key: 'all',  label: 'All rooms' },
  { key: 'free', label: 'Free beds' },
  { key: 'full', label: 'Full' },
]

function RoomForm({ initialData, properties, defaultPropertyId, occupied = 0, onSubmit, onCancel }) {
  const [form, setForm] = useState(() => ({
    propertyId: initialData?.propertyId ?? defaultPropertyId ?? properties[0]?.id ?? '',
    name: initialData?.name ?? '',
    floor: initialData?.floor ?? '',
    capacity: String(initialData?.capacity ?? 2),
    rent: initialData?.rent ? String(initialData.rent) : '',
    notes: initialData?.notes ?? '',
  }))
  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }))
  const { run, busy, error } = useAsyncAction(onSubmit)

  function handleSubmit(e) {
    e.preventDefault()
    run({ ...form, name: form.name.trim(), capacity: Number(form.capacity), rent: Number(form.rent) || 0 })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {!initialData && properties.length > 1 && (
        <div>
          <label htmlFor="r-prop" className={labelCls}>Property *</label>
          <select id="r-prop" required value={form.propertyId} onChange={e => set('propertyId', e.target.value)} className={inputCls}>
            {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      )}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="r-name" className={labelCls}>Room name *</label>
          <input id="r-name" required maxLength={20} value={form.name} onChange={e => set('name', e.target.value)} placeholder="A-204" className={inputCls} />
        </div>
        <div>
          <label htmlFor="r-floor" className={labelCls}>Floor</label>
          <input id="r-floor" maxLength={20} value={form.floor} onChange={e => set('floor', e.target.value)} placeholder="2nd" className={inputCls} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="r-cap" className={labelCls}>Beds *</label>
          <input id="r-cap" required type="number" min={Math.max(1, occupied)} max={20} step={1} value={form.capacity} onChange={e => set('capacity', e.target.value)} className={inputCls} />
          {occupied > 0 && <p className="text-xs text-slate-400 mt-1">{occupied} bed(s) are occupied, so at least {occupied}.</p>}
        </div>
        <div>
          <label htmlFor="r-rent" className={labelCls}>Rent per bed</label>
          <input id="r-rent" type="number" min={0} step={1} inputMode="numeric" value={form.rent} onChange={e => set('rent', e.target.value)} placeholder="9000" className={inputCls} />
          <p className="text-xs text-slate-400 mt-1">Suggested rent for new tenants.</p>
        </div>
      </div>
      <div>
        <label htmlFor="r-notes" className={labelCls}>Notes</label>
        <input id="r-notes" maxLength={300} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="e.g. AC, attached bathroom, balcony" className={inputCls} />
      </div>
      <FormError message={error} />
      <div className="flex justify-end gap-3 pt-1">
        <button type="button" onClick={onCancel} disabled={busy} className="px-5 py-2.5 text-sm font-medium text-slate-600 border border-slate-200 rounded-xl hover:border-slate-300 disabled:opacity-50">Cancel</button>
        <button type="submit" disabled={busy} className="px-5 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl disabled:opacity-60">
          {busy ? 'Saving…' : initialData ? 'Save changes' : 'Add room'}
        </button>
      </div>
    </form>
  )
}

function BedDots({ capacity, occupied }) {
  return (
    <div className="flex flex-wrap gap-1" aria-hidden="true">
      {Array.from({ length: capacity }, (_, i) => (
        <span key={i} className={`w-3.5 h-3.5 rounded ${i < occupied ? 'bg-indigo-500' : 'bg-slate-200'}`} />
      ))}
    </div>
  )
}

export default function RoomsPage() {
  const { rooms, tenants, properties, currentProperty, propertyById, selectedPropertyId, addRoom, updateRoom, archiveRoom } = useAppData()
  const { can } = useAuth()
  const { showToast } = useToast()
  const canManage = can('rooms.manage')
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState(null)
  const [archiving, setArchiving] = useState(null)

  const occupantsByRoom = useMemo(() => {
    const map = new Map()
    for (const t of tenants) {
      if (t.status !== 'active' || !t.roomId) continue
      map.set(t.roomId, [...(map.get(t.roomId) ?? []), t])
    }
    return map
  }, [tenants])

  const rows = useMemo(() => rooms.map(r => {
    const occupants = occupantsByRoom.get(r.id) ?? []
    return { ...r, occupants, occupied: occupants.length, free: Math.max(0, r.capacity - occupants.length) }
  }), [rooms, occupantsByRoom])

  const totals = rows.reduce((s, r) => ({ beds: s.beds + r.capacity, occupied: s.occupied + r.occupied }), { beds: 0, occupied: 0 })
  const occupancy = totals.beds ? Math.round((totals.occupied / totals.beds) * 100) : 0

  const visible = rows
    .filter(r => filter === 'all' || (filter === 'free' ? r.free > 0 : r.free === 0))
    .filter(r => {
      const q = search.trim().toLowerCase()
      return !q || r.name.toLowerCase().includes(q) || r.occupants.some(t => t.name.toLowerCase().includes(q))
    })

  // Group by property when looking at all of them.
  const groups = currentProperty || properties.length <= 1
    ? [{ id: currentProperty?.id ?? properties[0]?.id, name: null, rooms: visible }]
    : properties.map(p => ({ id: p.id, name: p.name, rooms: visible.filter(r => r.propertyId === p.id) })).filter(g => g.rooms.length)

  async function handleAdd(data) {
    const room = await addRoom(data)
    setAdding(false)
    showToast(`Room ${room.name} added.`)
  }
  async function handleEdit(data) {
    const { propertyId: _ignored, ...changes } = data
    await updateRoom(editing.id, changes)
    setEditing(null)
    showToast('Room updated.')
  }
  async function handleArchive() {
    await archiveRoom(archiving.id)
    showToast(`Room ${archiving.name} archived.`, 'warning')
    setArchiving(null)
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Rooms & Beds</h1>
          <p className="text-slate-500 text-sm mt-1">
            {rows.length} rooms · {totals.beds} beds · {totals.occupied} occupied · {totals.beds - totals.occupied} free ({occupancy}% full)
          </p>
        </div>
        {canManage && (
          <button onClick={() => setAdding(true)} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm px-4 py-2.5 rounded-xl transition-colors shrink-0">
            <Plus size={16} /> <span className="hidden sm:inline">Add Room</span><span className="sm:hidden">Add</span>
          </button>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
          {FILTERS.map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${filter === f.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="search" aria-label="Search rooms" placeholder="Search room or tenant…" value={search} onChange={e => setSearch(e.target.value)}
            className="w-full sm:w-64 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500" />
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState icon={BedDouble}
          title={rows.length ? 'No rooms match' : 'No rooms yet'}
          message={rows.length ? 'Try another filter or search.' : 'Add your rooms with their bed count to track occupancy and free beds.'}
          actionLabel={!rows.length && canManage ? 'Add Room' : undefined} onAction={() => setAdding(true)} />
      ) : groups.map(group => (
        <section key={group.id ?? 'all'} className="mb-8">
          {group.name && <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">{group.name}</h2>}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {group.rooms.map(r => (
              <div key={r.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex flex-col">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 text-base">{r.name}</p>
                    <p className="text-xs text-slate-400">{[r.floor && `Floor ${r.floor}`, r.rent ? `${formatCurrency(r.rent)}/bed` : null].filter(Boolean).join(' · ') || '—'}</p>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border shrink-0 ${r.free === 0 ? 'bg-slate-100 text-slate-600 border-slate-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                    {r.free === 0 ? 'Full' : `${r.free} free`}
                  </span>
                </div>
                <div className="flex items-center gap-3 mb-3">
                  <BedDots capacity={r.capacity} occupied={r.occupied} />
                  <span className="text-xs text-slate-500">{r.occupied}/{r.capacity} beds</span>
                </div>
                <ul className="text-sm text-slate-700 space-y-0.5 flex-1">
                  {r.occupants.length === 0 && <li className="text-slate-400 text-sm">Empty</li>}
                  {r.occupants.map(t => <li key={t.id} className="truncate">{t.name}</li>)}
                </ul>
                {r.notes && <p className="text-xs text-slate-400 mt-2 line-clamp-2">{r.notes}</p>}
                {canManage && (
                  <div className="flex gap-2 mt-4 pt-3 border-t border-slate-100">
                    <button onClick={() => setEditing(r)} className="flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-indigo-600 px-2 py-1 rounded-lg hover:bg-slate-50">
                      <Pencil size={13} /> Edit
                    </button>
                    <button onClick={() => setArchiving(r)} disabled={r.occupied > 0} title={r.occupied ? 'Move or vacate tenants first' : 'Archive room'}
                      className="flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-red-600 px-2 py-1 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:hover:text-slate-600 disabled:cursor-not-allowed">
                      <Archive size={13} /> Archive
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      ))}

      <Modal isOpen={adding} onClose={() => setAdding(false)} title="Add room">
        {adding && <RoomForm properties={properties} defaultPropertyId={selectedPropertyId !== 'all' ? selectedPropertyId : undefined} onSubmit={handleAdd} onCancel={() => setAdding(false)} />}
      </Modal>
      <Modal isOpen={!!editing} onClose={() => setEditing(null)} title={`Edit room ${editing?.name ?? ''}`}>
        {editing && <RoomForm initialData={editing} properties={properties} occupied={editing.occupied} onSubmit={handleEdit} onCancel={() => setEditing(null)} />}
      </Modal>
      <ConfirmDialog
        isOpen={!!archiving}
        title={`Archive room ${archiving?.name ?? ''}?`}
        message={<>It will no longer appear in room lists{archiving && propertyById.get(archiving.propertyId) ? ` for ${propertyById.get(archiving.propertyId).name}` : ''}. Past tenants keep their history.</>}
        confirmLabel="Archive room"
        onConfirm={handleArchive}
        onCancel={() => setArchiving(null)}
      />
    </div>
  )
}
