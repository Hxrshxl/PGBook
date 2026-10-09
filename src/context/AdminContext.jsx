'use client'
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { adminApi, registerStepUpHandler } from '@/utils/adminApi'
import Modal from '@/components/ui/Modal'
import FormError from '@/components/ui/FormError'

const AdminContext = createContext(null)

/** A modal that asks for a fresh 2FA code before a sensitive action. */
function StepUpPrompt({ onDone }) {
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await adminApi.post('/auth/step-up', { code })
      onDone(true)
    } catch (err) {
      setError(err.message)
      setCode('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal isOpen onClose={() => onDone(false)} maxWidth="max-w-sm">
      <form onSubmit={submit} className="text-center">
        <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center mx-auto mb-4">
          <ShieldCheck size={22} className="text-indigo-600" />
        </div>
        <h2 className="text-slate-900 font-bold text-lg mb-1">Confirm it&apos;s you</h2>
        <p className="text-slate-500 text-sm mb-5">This action needs a fresh code from your authenticator app. It stays unlocked for 5 minutes.</p>
        <input
          autoFocus
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
          placeholder="123456"
          aria-label="6-digit code"
          className="w-full text-center tracking-[0.5em] text-2xl font-semibold border border-slate-200 rounded-xl px-3 py-3 text-slate-900 focus:outline-none focus:border-indigo-500"
        />
        {error && <div className="mt-3 text-left"><FormError message={error} /></div>}
        <div className="flex gap-3 mt-5">
          <button type="button" onClick={() => onDone(false)} className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-600 border border-slate-200 rounded-xl hover:border-slate-300">Cancel</button>
          <button type="submit" disabled={busy || code.length !== 6} className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl disabled:opacity-50">
            {busy ? 'Checking…' : 'Verify'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export function AdminProvider({ children }) {
  const [admin, setAdmin] = useState(null)
  const [meta, setMeta] = useState({})
  const [status, setStatus] = useState('loading') // loading | ready
  const [stepUp, setStepUp] = useState(null)
  const resolver = useRef(null)

  const refresh = useCallback(async () => {
    try {
      const data = await adminApi.get('/auth/me')
      setAdmin(data.admin)
      setMeta({ environment: data.environment, idleTimeoutMinutes: data.idleTimeoutMinutes })
      setStatus('ready')
    } catch {
      const next = encodeURIComponent(window.location.pathname + window.location.search)
      window.location.assign(`/admin/login?next=${next}`)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  useEffect(() => registerStepUpHandler(() => new Promise(resolve => {
    resolver.current = resolve
    setStepUp({})
  })), [])

  function finishStepUp(ok) {
    resolver.current?.(ok)
    resolver.current = null
    setStepUp(null)
  }

  async function logout() {
    await adminApi.post('/auth/logout').catch(() => {})
    window.location.assign('/admin/login')
  }

  const can = useCallback(capability => !!admin?.capabilities?.includes(capability), [admin])

  return (
    <AdminContext.Provider value={{ admin, status, meta, can, refresh, logout }}>
      {children}
      {stepUp && <StepUpPrompt onDone={finishStepUp} />}
    </AdminContext.Provider>
  )
}

export function useAdmin() {
  const ctx = useContext(AdminContext)
  if (!ctx) throw new Error('useAdmin must be used inside <AdminProvider>')
  return ctx
}
