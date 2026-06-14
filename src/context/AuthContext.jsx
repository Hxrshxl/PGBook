'use client'
import { createContext, useContext, useState } from 'react'
import { api } from '@/utils/api'

const AuthContext = createContext(null)
const STORAGE_KEY = 'pgbook_auth'

function loadUser() {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw).user ?? null : null
  } catch { return null }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(loadUser)

  async function login(email, password) {
    const data = await api.post('/auth/login', { email, password })
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    setUser(data.user)
    return data.user
  }

  async function signup({ name, pgName, email, password }) {
    const data = await api.post('/auth/signup', { name, pgName, email, password })
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    setUser(data.user)
    return data.user
  }

  function logout() {
    localStorage.removeItem(STORAGE_KEY)
    setUser(null)
  }

  function updateUser(updates) {
    const raw = localStorage.getItem(STORAGE_KEY)
    const current = raw ? JSON.parse(raw) : {}
    const merged = { ...current, user: { ...current.user, ...updates } }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged))
    setUser(merged.user)
  }

  return (
    <AuthContext.Provider value={{ user, login, signup, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
