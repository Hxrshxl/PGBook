'use client'
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useState } from 'react'
import { api } from '@/utils/api'
import { useAuth } from './AuthContext'

const AppContext = createContext(null)

const LISTS = ['properties', 'rooms', 'tenants', 'payments', 'utilityBills', 'complaints', 'expenses', 'cash']
const defaultState = {
  ...Object.fromEntries(LISTS.map(k => [k, []])),
  approvals: { requests: [], counts: { requests: 0, cash: 0, pendingCashAmount: 0 } },
}

// What each list needs, and where it comes from. Lists the role can't see stay empty.
const SOURCES = [
  { key: 'properties', path: '/properties', permission: 'settings.view' },
  { key: 'rooms', path: '/rooms', permission: 'rooms.view' },
  { key: 'tenants', path: '/tenants', permission: 'tenants.view' },
  { key: 'payments', path: '/payments', permission: 'rent.view' },
  { key: 'utilityBills', path: '/utility-bills', permission: 'bills.view' },
  { key: 'complaints', path: '/complaints', permission: 'complaints.view' },
  { key: 'expenses', path: '/expenses', permission: 'expenses.view' },
  { key: 'cash', path: '/cash', permission: 'rent.view' },
]

function upsert(list, items) {
  const byId = new Map(list.map(x => [x.id, x]))
  for (const item of items) byId.set(item.id, item)
  return [...byId.values()]
}

function reducer(state, action) {
  switch (action.type) {
    case 'LOAD':
      return { ...state, ...action.payload }
    case 'RESET':
      return defaultState
    case 'UPSERT':
      return { ...state, [action.list]: upsert(state[action.list], action.items) }
    case 'REMOVE':
      return { ...state, [action.list]: state[action.list].filter(x => x.id !== action.id) }
    case 'TENANT_REMOVE':
      return {
        ...state,
        tenants: state.tenants.filter(t => t.id !== action.id),
        payments: state.payments.filter(p => p.tenantId !== action.id),
        complaints: state.complaints.filter(c => c.tenantId !== action.id),
      }
    case 'ROOM_RENAMED':
      return { ...state, tenants: state.tenants.map(t => (t.roomId === action.room.id ? { ...t, room: action.room.name } : t)) }
    case 'APPROVALS':
      return { ...state, approvals: action.payload }
    default:
      return state
  }
}

/** The old single-PG settings shape that receipts, reminders and analytics read. */
function toSettings(property) {
  if (!property) return { pgName: '', address: '', ownerName: '', phone: '', upiId: '', logoText: '', totalBeds: 0, rentDueDay: 5, gstin: '' }
  return {
    propertyId: property.id, pgName: property.name, address: property.address, ownerName: property.ownerName, phone: property.phone,
    upiId: property.upiId, logoText: property.logoText, gstin: property.gstin, totalBeds: property.beds ?? property.totalBeds ?? 0,
    rentDueDay: property.rentDueDay, noticePeriodDays: property.noticePeriodDays, lateFee: property.lateFee,
  }
}

export function AppProvider({ children }) {
  const { user, can } = useAuth()
  const [state, dispatch] = useReducer(reducer, defaultState)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedPropertyId, setSelectedPropertyId] = useState('all')
  const userId = user?.id
  const storageKey = userId ? `pgbook_property_${userId}` : null

  const refreshApprovals = useCallback(async () => {
    if (!can('approvals.view')) return
    const data = await api.get('/approvals')
    dispatch({ type: 'APPROVALS', payload: { requests: data.requests, counts: data.counts } })
  }, [can])

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const allowed = SOURCES.filter(s => can(s.permission))
      const results = await Promise.all(allowed.map(s => api.get(s.path)))
      dispatch({ type: 'LOAD', payload: { ...Object.fromEntries(LISTS.map(k => [k, []])), ...Object.fromEntries(allowed.map((s, i) => [s.key, results[i]])) } })
      const properties = results[allowed.findIndex(s => s.key === 'properties')] ?? []
      let stored = null
      try { stored = localStorage.getItem(storageKey) } catch {}
      setSelectedPropertyId(properties.some(p => p.id === stored) ? stored : properties.length === 1 ? properties[0].id : 'all')
      await refreshApprovals().catch(() => {})
    } catch (e) {
      setError(e.message ?? 'Could not load your data.')
    } finally {
      setLoading(false)
    }
  }, [can, storageKey, refreshApprovals])

  useEffect(() => {
    if (!userId) { dispatch({ type: 'RESET' }); return }
    reload()
  }, [userId, reload])

  const selectProperty = useCallback(id => {
    setSelectedPropertyId(id)
    try { localStorage.setItem(storageKey, id) } catch {}
  }, [storageKey])

  // ── Derived, property-filtered views ───────────────────────
  const view = useMemo(() => {
    const propertyById = new Map(state.properties.map(p => [p.id, p]))
    const current = selectedPropertyId === 'all' ? null : propertyById.get(selectedPropertyId) ?? null
    const inScope = item => !current || item.propertyId === current.id
    const settings = current
      ? toSettings(current)
      : state.properties.length > 1
        ? { ...toSettings(state.properties[0]), propertyId: null, pgName: 'All properties', totalBeds: state.properties.reduce((s, p) => s + (p.beds ?? 0), 0) }
        : toSettings(state.properties[0])
    return {
      propertyById,
      currentProperty: current,
      tenants: state.tenants.filter(inScope),
      payments: state.payments.filter(inScope),
      utilityBills: state.utilityBills.filter(inScope),
      complaints: state.complaints.filter(inScope),
      expenses: state.expenses.filter(inScope),
      rooms: state.rooms.filter(inScope),
      cash: state.cash.filter(inScope),
      pgSettings: settings,
      /** Settings of the property a tenant/payment belongs to (receipts, reminders). */
      settingsFor: item => toSettings(propertyById.get(item?.propertyId) ?? state.properties[0]),
    }
  }, [state, selectedPropertyId])

  // Property to use for new records: the selected one, or undefined (the server picks when there's only one).
  const targetProperty = data => data.propertyId ?? (selectedPropertyId !== 'all' ? selectedPropertyId : undefined)
  const upsertList = (list, items) => dispatch({ type: 'UPSERT', list, items })

  // ── Tenants ─────────────────────────────────────────────────
  async function addTenant(formData) {
    const { tenant, payment } = await api.post('/tenants', { ...formData, propertyId: targetProperty(formData) })
    upsertList('tenants', [tenant])
    if (payment) upsertList('payments', [payment])
    return tenant
  }
  async function updateTenant(id, formData) {
    const { tenant, payments } = await api.put(`/tenants/${id}`, formData)
    upsertList('tenants', [tenant])
    if (payments.length) upsertList('payments', payments)
    return tenant
  }
  async function vacateTenant(id, moveOutDate) {
    upsertList('tenants', [await api.patch(`/tenants/${id}`, { status: 'vacated', moveOutDate })])
  }
  async function reactivateTenant(id) {
    upsertList('tenants', [await api.patch(`/tenants/${id}`, { status: 'active' })])
  }
  async function deleteTenant(id) {
    await api.delete(`/tenants/${id}`)
    dispatch({ type: 'TENANT_REMOVE', id })
  }

  // ── Dues & payments ─────────────────────────────────────────
  async function createDue(tenantId, month) {
    upsertList('payments', [await api.post('/payments', { tenantId, month })])
  }
  async function generateDues(month) {
    const { payments } = await api.post('/payments/generate', { month, propertyId: selectedPropertyId !== 'all' ? selectedPropertyId : undefined })
    upsertList('payments', payments)
    return payments
  }
  async function applyLateFees(month) {
    const { payments } = await api.post('/payments/late-fees', { month, propertyId: selectedPropertyId !== 'all' ? selectedPropertyId : undefined })
    upsertList('payments', payments)
    return payments
  }
  /** Returns { pending: true } when the change was sent to the owner for approval. */
  async function updateDue(id, data) {
    const result = await api.put(`/payments/${id}`, data)
    if (result.approval) { await refreshApprovals(); return { pending: true } }
    upsertList('payments', [result])
    return { pending: false }
  }
  async function deleteDue(id) {
    await api.delete(`/payments/${id}`)
    dispatch({ type: 'REMOVE', list: 'payments', id })
  }
  async function recordPayment(paymentId, entry) {
    const payment = await api.post(`/payments/${paymentId}/transactions`, entry)
    upsertList('payments', [payment])
    return payment
  }
  /** Returns { pending: true } when removal was sent to the owner for approval. */
  async function deletePaymentEntry(paymentId, txId, reason) {
    const result = await api.delete(`/payments/${paymentId}/transactions/${txId}`, reason ? { reason } : undefined)
    if (result.approval) { await refreshApprovals(); return { pending: true } }
    upsertList('payments', [result])
    return { pending: false }
  }

  // ── Cash handover ───────────────────────────────────────────
  async function collectCash(paymentId, entry) {
    const collection = await api.post('/cash', { paymentId, ...entry })
    upsertList('cash', [collection])
    await refreshApprovals().catch(() => {})
    return collection
  }
  async function decideCash(id, decision, note) {
    const { collection, payment } = await api.post(`/cash/${id}`, { decision, note })
    upsertList('cash', [collection])
    if (payment) upsertList('payments', [payment])
    await refreshApprovals().catch(() => {})
  }

  // ── Approvals (owner decides staff requests) ────────────────
  async function decideApproval(id, decision, note) {
    await api.post(`/approvals/${id}`, { decision, note })
    if (decision === 'approve') upsertList('payments', await api.get('/payments'))
    await refreshApprovals()
  }
  async function cancelApproval(id) {
    await api.delete(`/approvals/${id}`)
    await refreshApprovals()
  }

  // ── Utility bills ───────────────────────────────────────────
  async function addUtilityBill(data) {
    const { bill, payments } = await api.post('/utility-bills', { ...data, propertyId: targetProperty(data) })
    upsertList('utilityBills', [bill])
    upsertList('payments', payments)
    return bill
  }
  async function deleteUtilityBill(id) {
    const { payments } = await api.delete(`/utility-bills/${id}`)
    dispatch({ type: 'REMOVE', list: 'utilityBills', id })
    upsertList('payments', payments)
  }

  // ── Complaints ──────────────────────────────────────────────
  async function addComplaint(data) {
    const complaint = await api.post('/complaints', data)
    upsertList('complaints', [complaint])
    return complaint
  }
  async function updateComplaint(id, updates) {
    const complaint = await api.patch(`/complaints/${id}`, updates)
    upsertList('complaints', [complaint])
    return complaint
  }
  async function deleteComplaint(id) {
    await api.delete(`/complaints/${id}`)
    dispatch({ type: 'REMOVE', list: 'complaints', id })
  }

  // ── Properties & rooms ──────────────────────────────────────
  async function refreshProperties() {
    dispatch({ type: 'LOAD', payload: { properties: await api.get('/properties') } })
  }
  async function addProperty(data) {
    const property = await api.post('/properties', data)
    await refreshProperties()
    return property
  }
  async function updateProperty(id, data) {
    const property = await api.put(`/properties/${id}`, data)
    await refreshProperties()
    return property
  }
  async function archiveProperty(id) {
    await api.delete(`/properties/${id}`)
    if (selectedPropertyId === id) selectProperty('all')
    await refreshProperties()
  }
  async function addRoom(data) {
    const room = await api.post('/rooms', { ...data, propertyId: targetProperty(data) })
    upsertList('rooms', [room])
    await refreshProperties()
    return room
  }
  async function updateRoom(id, data) {
    const room = await api.put(`/rooms/${id}`, data)
    upsertList('rooms', [room])
    dispatch({ type: 'ROOM_RENAMED', room })
    await refreshProperties()
    return room
  }
  async function archiveRoom(id) {
    await api.delete(`/rooms/${id}`)
    dispatch({ type: 'REMOVE', list: 'rooms', id })
    await refreshProperties()
  }

  // ── Expenses ────────────────────────────────────────────────
  async function addExpense(data) {
    const expense = await api.post('/expenses', { ...data, propertyId: targetProperty(data) })
    upsertList('expenses', [expense])
    return expense
  }
  async function updateExpense(id, data) {
    const expense = await api.put(`/expenses/${id}`, data)
    upsertList('expenses', [expense])
    return expense
  }
  async function deleteExpense(id) {
    await api.delete(`/expenses/${id}`)
    dispatch({ type: 'REMOVE', list: 'expenses', id })
  }

  return (
    <AppContext.Provider value={{
      ...view,
      properties: state.properties,
      allRooms: state.rooms, allTenants: state.tenants,
      approvals: state.approvals,
      selectedPropertyId, selectProperty,
      loading, error, reload, refreshApprovals,
      addTenant, updateTenant, vacateTenant, reactivateTenant, deleteTenant,
      createDue, generateDues, applyLateFees, updateDue, deleteDue, recordPayment, deletePaymentEntry,
      collectCash, decideCash, decideApproval, cancelApproval,
      addUtilityBill, deleteUtilityBill,
      addComplaint, updateComplaint, deleteComplaint,
      addProperty, updateProperty, archiveProperty, addRoom, updateRoom, archiveRoom,
      addExpense, updateExpense, deleteExpense,
    }}>
      {children}
    </AppContext.Provider>
  )
}

export function useAppData() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useAppData must be used inside <AppProvider>')
  return ctx
}
