'use client'
import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { api, UNAUTHORIZED_EVENT } from '@/utils/api'
import { READ_ONLY_ALLOWED } from '@/lib/subscription'

const AuthContext = createContext(null)

// status: 'loading' | 'authenticated' | 'unauthenticated'
// Starts as 'loading' on both server and client so the first render always matches (no hydration errors).
// access: { role, roleLabel, permissions, propertyIds (null = all), org: { ownerName, plan, … } }
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [access, setAccess] = useState(null)
  const [status, setStatus] = useState('loading')

  const setSignedOut = useCallback(() => {
    setUser(null)
    setAccess(null)
    setStatus('unauthenticated')
  }, [])

  const loadMe = useCallback(async () => {
    const data = await api.get('/auth/me')
    setUser(data.user)
    setAccess(data.access)
    setStatus('authenticated')
    return data.user
  }, [])

  useEffect(() => {
    // Clean up the token the old version of the app kept in localStorage.
    try { localStorage.removeItem('pgbook_auth') } catch {}

    // The admin console and the resident app have their own, separate sessions.
    if (window.location.pathname.startsWith('/admin') || window.location.pathname === '/t' || window.location.pathname.startsWith('/t/')) {
      setStatus('unauthenticated')
      return
    }

    let cancelled = false
    // A 401 from the API also clears any stale session cookie, so the
    // middleware won't bounce /login back to /dashboard.
    loadMe().catch(() => { if (!cancelled) setSignedOut() })

    const onUnauthorized = async () => {
      await api.post('/auth/logout').catch(() => {})
      setSignedOut()
    }
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
    return () => {
      cancelled = true
      window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
    }
  }, [loadMe, setSignedOut])

  async function login(email, password) {
    await api.post('/auth/login', { email, password })
    return loadMe()
  }

  async function signup({ name, pgName, email, password }) {
    await api.post('/auth/signup', { name, pgName, email, password })
    return loadMe()
  }

  async function logout() {
    await api.post('/auth/logout').catch(() => {})
    setSignedOut()
  }

  async function updateProfile({ name }) {
    const { user } = await api.put('/auth/me', { name })
    setUser(user)
    return user
  }

  async function changePassword(currentPassword, newPassword) {
    await api.put('/auth/password', { currentPassword, newPassword })
  }

  // In read-only mode (lapsed subscription) only viewing, billing and export stay available,
  // so every "Add" / "Edit" button disappears without each page having to check.
  const can = useCallback(capability => {
    if (!access?.permissions?.includes(capability)) return false
    if (!access.billing?.readOnly) return true
    return capability.endsWith('.view') || READ_ONLY_ALLOWED.includes(capability)
  }, [access])

  return (
    <AuthContext.Provider value={{ user, access, status, can, login, signup, logout, loadMe, updateProfile, changePassword }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
