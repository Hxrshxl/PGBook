'use client'
import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { api, UNAUTHORIZED_EVENT } from '@/utils/api'

const AuthContext = createContext(null)

// status: 'loading' | 'authenticated' | 'unauthenticated'
// Starts as 'loading' on both server and client so the first render always matches (no hydration errors).
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [status, setStatus] = useState('loading')

  const setSignedOut = useCallback(() => {
    setUser(null)
    setStatus('unauthenticated')
  }, [])

  useEffect(() => {
    // Clean up the token the old version of the app kept in localStorage.
    try { localStorage.removeItem('pgbook_auth') } catch {}

    // The admin console has its own, separate session.
    if (window.location.pathname.startsWith('/admin')) {
      setStatus('unauthenticated')
      return
    }

    let cancelled = false
    api.get('/auth/me')
      .then(({ user }) => { if (!cancelled) { setUser(user); setStatus('authenticated') } })
      // A 401 from the API also clears any stale session cookie, so the
      // middleware won't bounce /login back to /dashboard.
      .catch(() => { if (!cancelled) setSignedOut() })

    const onUnauthorized = async () => {
      await api.post('/auth/logout').catch(() => {})
      setSignedOut()
    }
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
    return () => {
      cancelled = true
      window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
    }
  }, [setSignedOut])

  async function login(email, password) {
    const { user } = await api.post('/auth/login', { email, password })
    setUser(user)
    setStatus('authenticated')
    return user
  }

  async function signup({ name, pgName, email, password }) {
    const { user } = await api.post('/auth/signup', { name, pgName, email, password })
    setUser(user)
    setStatus('authenticated')
    return user
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

  // Keeps the cached user in sync after settings change (e.g. PG name).
  function updateUser(updates) {
    setUser(prev => (prev ? { ...prev, ...updates } : prev))
  }

  return (
    <AuthContext.Provider value={{ user, status, login, signup, logout, updateProfile, changePassword, updateUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
