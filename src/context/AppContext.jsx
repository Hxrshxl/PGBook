'use client'
import { createContext, useContext, useReducer, useEffect, useState } from 'react'
import { api } from '@/utils/api'
import { useAuth } from './AuthContext'
import { calcPaymentStatus, getCurrentMonth } from '@/utils/helpers'

const AppContext = createContext(null)

const defaultState = {
  tenants: [], payments: [], utilityBills: [], complaints: [],
  pgSettings: { pgName: '', address: '', ownerName: '', phone: '', upiId: '', logoText: 'PGBook' },
}

function reducer(state, action) {
  switch (action.type) {
    case 'LOAD':
      return { ...state, ...action.payload }
    case 'RESET':
      return defaultState
    case 'TENANT_ADD':
      return { ...state, tenants: [...state.tenants, action.payload] }
    case 'TENANT_UPDATE':
      return { ...state, tenants: state.tenants.map(t => t.id === action.payload.id ? action.payload : t) }
    case 'TENANT_VACATE':
      return { ...state, tenants: state.tenants.map(t => t.id === action.payload.id ? action.payload : t) }
    case 'PAYMENT_ADD':
      return { ...state, payments: [...state.payments, action.payload] }
    case 'PAYMENT_UPDATE':
      return { ...state, payments: state.payments.map(p => p.id === action.payload.id ? { ...p, ...action.payload } : p) }
    case 'UTILITY_ADD': {
      const { bill, updatedPayments } = action.payload
      const updatedIds = new Set(updatedPayments.map(p => p.id))
      return {
        ...state,
        utilityBills: [...state.utilityBills, bill],
        payments: state.payments.map(p => updatedIds.has(p.id) ? updatedPayments.find(u => u.id === p.id) : p),
      }
    }
    case 'UTILITY_DELETE':
      return { ...state, utilityBills: state.utilityBills.filter(b => b.id !== action.payload) }
    case 'COMPLAINT_ADD':
      return { ...state, complaints: [...state.complaints, action.payload] }
    case 'COMPLAINT_UPDATE':
      return { ...state, complaints: state.complaints.map(c => c.id === action.payload.id ? action.payload : c) }
    case 'SETTINGS_UPDATE':
      return { ...state, pgSettings: { ...state.pgSettings, ...action.payload } }
    default:
      return state
  }
}

export function AppProvider({ children }) {
  const { user } = useAuth()
  const [state, dispatch] = useReducer(reducer, defaultState)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) { dispatch({ type: 'RESET' }); setLoading(false); return }
    let cancelled = false
    async function fetchAll() {
      setLoading(true)
      try {
        const [tenants, payments, utilityBills, complaints, pgSettings] = await Promise.all([
          api.get('/tenants'),
          api.get('/payments'),
          api.get('/utility-bills'),
          api.get('/complaints'),
          api.get('/settings'),
        ])
        if (!cancelled) dispatch({ type: 'LOAD', payload: { tenants, payments, utilityBills, complaints, pgSettings } })
      } catch (e) {
        console.error('Failed to load app data:', e)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchAll()
    return () => { cancelled = true }
  }, [user])

  // ── Tenant actions ──────────────────────────────────────────
  async function addTenant(formData) {
    const tenant = await api.post('/tenants', formData)
    dispatch({ type: 'TENANT_ADD', payload: tenant })
    const payment = await api.post('/payments', {
      tenantId: tenant.id, month: getCurrentMonth(),
      rentAmount: tenant.rentAmount, utilityShare: 0,
      amountPaid: 0, status: 'pending', paidDate: null, notes: '',
    })
    dispatch({ type: 'PAYMENT_ADD', payload: payment })
    return tenant
  }

  async function updateTenant(id, formData) {
    const tenant = await api.put(`/tenants/${id}`, formData)
    dispatch({ type: 'TENANT_UPDATE', payload: tenant })
    return tenant
  }

  async function vacateTenant(id) {
    const tenant = await api.patch(`/tenants/${id}`)
    dispatch({ type: 'TENANT_VACATE', payload: tenant })
    return tenant
  }

  // ── Payment actions ─────────────────────────────────────────
  async function addPayment(data) {
    const payment = await api.post('/payments', data)
    dispatch({ type: 'PAYMENT_ADD', payload: payment })
    return payment
  }

  async function updatePayment(id, data) {
    const payment = await api.put(`/payments/${id}`, data)
    dispatch({ type: 'PAYMENT_UPDATE', payload: payment })
    return payment
  }

  // ── Utility bill actions ────────────────────────────────────
  async function addUtilityBill(data) {
    const result = await api.post('/utility-bills', data)
    dispatch({ type: 'UTILITY_ADD', payload: result })
    return result.bill
  }

  async function deleteUtilityBill(id) {
    await api.delete(`/utility-bills/${id}`)
    dispatch({ type: 'UTILITY_DELETE', payload: id })
  }

  // ── Complaint actions ───────────────────────────────────────
  async function addComplaint(data) {
    const complaint = await api.post('/complaints', data)
    dispatch({ type: 'COMPLAINT_ADD', payload: complaint })
    return complaint
  }

  async function updateComplaintStatus(id, status, ownerNotes) {
    const complaint = await api.patch(`/complaints/${id}`, { status, ownerNotes })
    dispatch({ type: 'COMPLAINT_UPDATE', payload: complaint })
    return complaint
  }

  // ── Settings ────────────────────────────────────────────────
  async function updateSettings(data) {
    const settings = await api.put('/settings', data)
    dispatch({ type: 'SETTINGS_UPDATE', payload: settings })
    return settings
  }

  return (
    <AppContext.Provider value={{
      ...state, loading,
      addTenant, updateTenant, vacateTenant,
      addPayment, updatePayment,
      addUtilityBill, deleteUtilityBill,
      addComplaint, updateComplaintStatus,
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
