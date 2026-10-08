'use client'
import { createContext, useCallback, useContext, useEffect, useReducer, useState } from 'react'
import { api } from '@/utils/api'
import { useAuth } from './AuthContext'

const AppContext = createContext(null)

const defaultState = {
  tenants: [], payments: [], utilityBills: [], complaints: [],
  pgSettings: { pgName: '', address: '', ownerName: '', phone: '', upiId: '', logoText: '', totalBeds: 0, rentDueDay: 5 },
}

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
    case 'TENANTS_UPSERT':
      return { ...state, tenants: upsert(state.tenants, action.payload) }
    case 'TENANT_REMOVE':
      return {
        ...state,
        tenants: state.tenants.filter(t => t.id !== action.payload),
        payments: state.payments.filter(p => p.tenantId !== action.payload),
        complaints: state.complaints.filter(c => c.tenantId !== action.payload),
      }
    case 'PAYMENTS_UPSERT':
      return { ...state, payments: upsert(state.payments, action.payload) }
    case 'PAYMENT_REMOVE':
      return { ...state, payments: state.payments.filter(p => p.id !== action.payload) }
    case 'BILLS_UPSERT':
      return { ...state, utilityBills: upsert(state.utilityBills, action.payload) }
    case 'BILL_REMOVE':
      return { ...state, utilityBills: state.utilityBills.filter(b => b.id !== action.payload) }
    case 'COMPLAINTS_UPSERT':
      return { ...state, complaints: upsert(state.complaints, action.payload) }
    case 'COMPLAINT_REMOVE':
      return { ...state, complaints: state.complaints.filter(c => c.id !== action.payload) }
    case 'SETTINGS_SET':
      return { ...state, pgSettings: { ...state.pgSettings, ...action.payload } }
    default:
      return state
  }
}

export function AppProvider({ children }) {
  const { user, updateUser } = useAuth()
  const [state, dispatch] = useReducer(reducer, defaultState)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const userId = user?.id

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [tenants, payments, utilityBills, complaints, pgSettings] = await Promise.all([
        api.get('/tenants'),
        api.get('/payments'),
        api.get('/utility-bills'),
        api.get('/complaints'),
        api.get('/settings'),
      ])
      dispatch({ type: 'LOAD', payload: { tenants, payments, utilityBills, complaints, pgSettings: { ...defaultState.pgSettings, ...pgSettings } } })
    } catch (e) {
      setError(e.message ?? 'Could not load your data.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!userId) { dispatch({ type: 'RESET' }); return }
    reload()
  }, [userId, reload])

  // ── Tenants ─────────────────────────────────────────────────
  async function addTenant(formData) {
    const { tenant, payment } = await api.post('/tenants', formData)
    dispatch({ type: 'TENANTS_UPSERT', payload: [tenant] })
    if (payment) dispatch({ type: 'PAYMENTS_UPSERT', payload: [payment] })
    return tenant
  }

  async function updateTenant(id, formData) {
    const { tenant, payments } = await api.put(`/tenants/${id}`, formData)
    dispatch({ type: 'TENANTS_UPSERT', payload: [tenant] })
    if (payments.length) dispatch({ type: 'PAYMENTS_UPSERT', payload: payments })
    return tenant
  }

  async function vacateTenant(id, moveOutDate) {
    const tenant = await api.patch(`/tenants/${id}`, { status: 'vacated', moveOutDate })
    dispatch({ type: 'TENANTS_UPSERT', payload: [tenant] })
    return tenant
  }

  async function reactivateTenant(id) {
    const tenant = await api.patch(`/tenants/${id}`, { status: 'active' })
    dispatch({ type: 'TENANTS_UPSERT', payload: [tenant] })
    return tenant
  }

  async function deleteTenant(id) {
    await api.delete(`/tenants/${id}`)
    dispatch({ type: 'TENANT_REMOVE', payload: id })
  }

  // ── Dues & payments ─────────────────────────────────────────
  async function createDue(tenantId, month) {
    const payment = await api.post('/payments', { tenantId, month })
    dispatch({ type: 'PAYMENTS_UPSERT', payload: [payment] })
    return payment
  }

  async function generateDues(month) {
    const { payments } = await api.post('/payments/generate', { month })
    dispatch({ type: 'PAYMENTS_UPSERT', payload: payments })
    return payments
  }

  async function updateDue(id, data) {
    const payment = await api.put(`/payments/${id}`, data)
    dispatch({ type: 'PAYMENTS_UPSERT', payload: [payment] })
    return payment
  }

  async function deleteDue(id) {
    await api.delete(`/payments/${id}`)
    dispatch({ type: 'PAYMENT_REMOVE', payload: id })
  }

  async function recordPayment(paymentId, entry) {
    const payment = await api.post(`/payments/${paymentId}/transactions`, entry)
    dispatch({ type: 'PAYMENTS_UPSERT', payload: [payment] })
    return payment
  }

  async function deletePaymentEntry(paymentId, txId) {
    const payment = await api.delete(`/payments/${paymentId}/transactions/${txId}`)
    dispatch({ type: 'PAYMENTS_UPSERT', payload: [payment] })
    return payment
  }

  // ── Utility bills ───────────────────────────────────────────
  async function addUtilityBill(data) {
    const { bill, payments } = await api.post('/utility-bills', data)
    dispatch({ type: 'BILLS_UPSERT', payload: [bill] })
    dispatch({ type: 'PAYMENTS_UPSERT', payload: payments })
    return bill
  }

  async function deleteUtilityBill(id) {
    const { payments } = await api.delete(`/utility-bills/${id}`)
    dispatch({ type: 'BILL_REMOVE', payload: id })
    dispatch({ type: 'PAYMENTS_UPSERT', payload: payments })
  }

  // ── Complaints ──────────────────────────────────────────────
  async function addComplaint(data) {
    const complaint = await api.post('/complaints', data)
    dispatch({ type: 'COMPLAINTS_UPSERT', payload: [complaint] })
    return complaint
  }

  async function updateComplaint(id, updates) {
    const complaint = await api.patch(`/complaints/${id}`, updates)
    dispatch({ type: 'COMPLAINTS_UPSERT', payload: [complaint] })
    return complaint
  }

  async function deleteComplaint(id) {
    await api.delete(`/complaints/${id}`)
    dispatch({ type: 'COMPLAINT_REMOVE', payload: id })
  }

  // ── Settings ────────────────────────────────────────────────
  async function updateSettings(data) {
    const pgSettings = await api.put('/settings', data)
    dispatch({ type: 'SETTINGS_SET', payload: pgSettings })
    updateUser({ pgSettings })
    return pgSettings
  }

  return (
    <AppContext.Provider value={{
      ...state, loading, error, reload,
      addTenant, updateTenant, vacateTenant, reactivateTenant, deleteTenant,
      createDue, generateDues, updateDue, deleteDue, recordPayment, deletePaymentEntry,
      addUtilityBill, deleteUtilityBill,
      addComplaint, updateComplaint, deleteComplaint,
      updateSettings,
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
