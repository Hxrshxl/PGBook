'use client'
import { useMemo, useState } from 'react'
import { BedDouble, Plus } from 'lucide-react'
import { useAppData } from '@/context/AppContext'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { useAsyncAction } from '@/hooks/useAsyncAction'
import { formatCurrency } from '@/utils/helpers'
import Modal from '@/components/ui/Modal'
import Badge from '@/components/ui/Badge'
import EmptyState from '@/components/ui/EmptyState'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import FormError from '@/components/ui/FormError'
import PageHeader from '@/components/ui/PageHeader'
import StatStrip from '@/components/ui/StatStrip'
import Tabs from '@/components/ui/Tabs'
import SearchInput from '@/components/ui/SearchInput'
import RowMenu from '@/components/ui/RowMenu'
import { btn, page } from '@/components/ui/styles'

const inputCls = 'w-full border border-slate-200 rounded-md px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 transition-colors bg-white'
const labelCls = 'block text-[13px] font-medium text-slate-700 mb-1.5'

const FILTERS = [
  { key: 'all',  label: 'All rooms' },
  { key: 'free', label: 'With free beds' },
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
        <button type="button" onClick={onCancel} disabled={busy} className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap h-9 px-3.5 text-sm rounded-md border border-slate-200 bg-white font-medium text-slate-700 shadow-xs transition-colors hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50">Cancel</button>
        <button type="submit" disabled={busy} className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap h-9 px-3.5 text-sm rounded-md bg-indigo-600 font-medium text-white shadow-xs transition-colors hover:bg-indigo-700 disabled:opacity-50">
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
        <span key={i} className={`h-2.5 w-2.5 rounded-sm ${i < occupied ? 'bg-indigo-500' : 'bg-slate-200'}`} />
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

  const counts = {
    all: rows.length,
    free: rows.filter(r => r.free > 0).length,
    full: rows.filter(r => r.free === 0).length,
  }
  const menuFor = r => [
    { label: 'Edit room', onClick: () => setEditing(r) },
    { label: r.occupied ? 'Archive (move tenants out first)' : 'Archive room', onClick: () => r.occupied ? showToast('Move or vacate the tenants in this room first.', 'warning') : setArchiving(r), danger: !r.occupied },
  ]

  return (
    <div className={`${page} mx-auto max-w-6xl`}>
      <PageHeader
        title="Rooms"
        description="Beds, who is in them, and what is free."
        actions={canManage && <button onClick={() => setAdding(true)} className={btn.primary}><Plus size={15} /> Add room</button>}
      />

      {rows.length > 0 && (
        <StatStrip className="mb-6" items={[
          { label: 'Rooms', value: rows.length },
          { label: 'Beds', value: totals.beds },
          { label: 'Occupied', value: totals.occupied, sub: `${occupancy}% occupancy` },
          { label: 'Free beds', value: totals.beds - totals.occupied, tone: totals.beds - totals.occupied > 0 ? 'positive' : 'default' },
        ]} />
      )}

      <div className="mb-4 flex flex-col-reverse gap-3 sm:flex-row sm:items-end sm:justify-between">
        <Tabs tabs={FILTERS.map(f => ({ ...f, count: counts[f.key] }))} value={filter} onChange={setFilter} className="flex-1" />
        <SearchInput value={search} onChange={setSearch} placeholder="Search room or tenant" label="Search rooms" />
      </div>

      {visible.length === 0 ? (
        <EmptyState icon={BedDouble}
          title={rows.length ? 'No rooms match' : 'No rooms yet'}
          message={rows.length ? 'Try another filter or search.' : 'Add your rooms with their bed count to track occupancy and free beds.'}
          actionLabel={!rows.length && canManage ? 'Add room' : undefined} onAction={() => setAdding(true)} />
      ) : groups.map(group => (
        <section key={group.id ?? 'all'} className="mb-6">
          {group.name && <h2 className="mb-2 text-sm font-medium text-slate-900">{group.name} <span className="font-normal text-slate-500">· {group.rooms.length} room{group.rooms.length === 1 ? '' : 's'}</span></h2>}
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <table className="hidden w-full text-sm md:table">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                  <th scope="col" className="py-2.5 pl-4 pr-3 font-medium">Room</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Beds</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Tenants</th>
                  <th scope="col" className="whitespace-nowrap px-3 py-2.5 text-right font-medium">Rent / bed</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Availability</th>
                  {canManage && <th scope="col" className="w-10 py-2.5 pl-3 pr-4"><span className="sr-only">Actions</span></th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {group.rooms.map(r => (
                  <tr key={r.id} className="align-top hover:bg-slate-50/70">
                    <td className="py-2.5 pl-4 pr-3">
                      <p className="font-medium text-slate-900">{r.name}</p>
                      <p className="max-w-[220px] truncate text-xs text-slate-500" title={r.notes || undefined}>{[r.floor && `Floor ${r.floor}`, r.notes].filter(Boolean).join(' · ') || '—'}</p>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2.5 pt-1">
                        <BedDots capacity={r.capacity} occupied={r.occupied} />
                        <span className="whitespace-nowrap text-xs tabular-nums text-slate-500">{r.occupied}/{r.capacity}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-slate-700">
                      {r.occupants.length ? r.occupants.map(t => t.name).join(', ') : <span className="text-slate-400">Empty</span>}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right text-slate-600">{r.rent ? formatCurrency(r.rent) : <span className="text-slate-300">—</span>}</td>
                    <td className="px-3 py-2.5">
                      {r.free === 0 ? <Badge tone="gray">Full</Badge> : <Badge tone="green">{r.free} free</Badge>}
                    </td>
                    {canManage && <td className="py-2 pl-3 pr-4 text-right"><RowMenu items={menuFor(r)} label={`Actions for room ${r.name}`} /></td>}
                  </tr>
                ))}
              </tbody>
            </table>

            <ul className="divide-y divide-slate-100 md:hidden">
              {group.rooms.map(r => (
                <li key={r.id} className="flex items-start gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-slate-900">{r.name}</p>
                      {r.free === 0 ? <Badge tone="gray">Full</Badge> : <Badge tone="green">{r.free} free</Badge>}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-slate-500">{r.occupied}/{r.capacity} beds · {r.occupants.length ? r.occupants.map(t => t.name).join(', ') : 'empty'}</p>
                  </div>
                  {canManage && <RowMenu items={menuFor(r)} label={`Actions for room ${r.name}`} />}
                </li>
              ))}
            </ul>
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
