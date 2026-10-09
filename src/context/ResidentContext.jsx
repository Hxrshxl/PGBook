'use client'
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api, RESIDENT_UNAUTHORIZED_EVENT } from '@/utils/api'

const ResidentContext = createContext(null)
const STORAGE_KEY = 'pgbook_resident_stay'

// The signed-in tenant, their stays (a person can have stays at several PGs over the
// years), and which stay the app is showing. Every API call carries that stay's id.
export function ResidentProvider({ children }) {
  const [resident, setResident] = useState(null)
  const [tenancies, setTenancies] = useState([])
  const [tenancyId, setTenancyId] = useState(null)
  const [status, setStatus] = useState('loading') // loading | ready | error
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      const data = await api.get('/resident/me')
      setResident(data.resident)
      setTenancies(data.tenancies)
      let stored = null
      try { stored = localStorage.getItem(STORAGE_KEY) } catch {}
      const pick = data.tenancies.find(t => t.id === stored) ?? data.tenancies.find(t => t.status === 'active') ?? data.tenancies[0]
      setTenancyId(pick?.id ?? null)
      setStatus('ready')
    } catch (err) {
      if (err.status !== 401) { setError(err.message); setStatus('error') }
    }
  }, [])

  useEffect(() => {
    load()
    const onUnauthorized = () => window.location.replace('/t')
    window.addEventListener(RESIDENT_UNAUTHORIZED_EVENT, onUnauthorized)
    return () => window.removeEventListener(RESIDENT_UNAUTHORIZED_EVENT, onUnauthorized)
  }, [load])

  const chooseTenancy = useCallback(id => {
    setTenancyId(id)
    try { localStorage.setItem(STORAGE_KEY, id) } catch {}
  }, [])

  const client = useMemo(() => api.with(tenancyId ? { 'X-Tenancy': tenancyId } : {}), [tenancyId])
  const stay = tenancies.find(t => t.id === tenancyId) ?? null

  async function logout() {
    await api.post('/resident/logout').catch(() => {})
    try { localStorage.removeItem(STORAGE_KEY) } catch {}
    window.location.replace('/t')
  }

  async function acceptPrivacy() {
    const { resident: r } = await api.put('/resident/me', { consent: true })
    setResident(r)
  }

  return (
    <ResidentContext.Provider value={{ resident, tenancies, tenancyId, stay, chooseTenancy, client, status, error, reload: load, logout, acceptPrivacy }}>
      {children}
    </ResidentContext.Provider>
  )
}

export function useResident() {
  const ctx = useContext(ResidentContext)
  if (!ctx) throw new Error('useResident must be used inside <ResidentProvider>')
  return ctx
}
