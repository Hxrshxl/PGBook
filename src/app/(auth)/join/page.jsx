'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Building2, Eye, EyeOff, AlertCircle } from 'lucide-react'
import { api } from '@/utils/api'
import Spinner from '@/components/ui/Spinner'

const inputCls = 'w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors'

// A staff member accepts the owner's invite: confirms their name and sets a password.
export default function JoinPage() {
  const [token, setToken] = useState('')
  const [invite, setInvite] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('token') ?? ''
    setToken(t)
    if (!t) { setLoadError('This invite link is not complete. Open the full link the owner sent you.'); return }
    api.get(`/join?token=${encodeURIComponent(t)}`)
      .then(data => { setInvite(data); setName(data.name) })
      .catch(e => setLoadError(e.message))
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (password.length < 8) return setError('Password must be at least 8 characters.')
    if (password !== confirm) return setError('Passwords do not match.')
    setBusy(true)
    try {
      await api.post('/join', { token, name: name.trim(), password })
      window.location.assign('/dashboard') // full reload so the new session is picked up
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <div className="hero-bg min-h-screen flex items-center justify-center px-5 py-12">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center">
            <Building2 size={20} className="text-white" />
          </div>
          <span style={{ fontFamily: 'Space Grotesk' }} className="text-white font-bold text-2xl tracking-tight">
            PG<span className="text-indigo-400">Book</span>
          </span>
        </div>

        <div className="bg-[#111827] border border-white/10 rounded-2xl p-8">
          {loadError ? (
            <>
              <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 mb-5">
                <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
                <p className="text-red-300 text-sm">{loadError}</p>
              </div>
              <Link href="/login" className="block text-center text-indigo-400 hover:text-indigo-300 text-sm font-medium">Already joined? Sign in</Link>
            </>
          ) : !invite ? (
            <div className="flex justify-center py-8"><Spinner size={26} className="text-indigo-400" /></div>
          ) : (
            <>
              <h1 className="text-xl font-bold text-white mb-1">Join {invite.pgName || `${invite.owner}'s PG`}</h1>
              <p className="text-slate-400 text-sm mb-6">{invite.owner} invited you as <span className="text-white font-medium">{invite.role}</span>. Set a password to finish.</p>

              {error && (
                <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 mb-5">
                  <AlertCircle size={16} className="text-red-400 shrink-0" />
                  <p className="text-red-300 text-sm">{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="j-email" className="block text-slate-400 text-sm font-medium mb-1.5">Email</label>
                  <input id="j-email" readOnly value={invite.email} className={`${inputCls} text-slate-400`} />
                </div>
                <div>
                  <label htmlFor="j-name" className="block text-slate-400 text-sm font-medium mb-1.5">Your name</label>
                  <input id="j-name" required maxLength={100} value={name} onChange={e => setName(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label htmlFor="j-pw" className="block text-slate-400 text-sm font-medium mb-1.5">Password</label>
                  <div className="relative">
                    <input id="j-pw" type={show ? 'text' : 'password'} required minLength={8} maxLength={128} autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 8 characters" className={`${inputCls} pr-10`} />
                    <button type="button" onClick={() => setShow(v => !v)} aria-label={show ? 'Hide password' : 'Show password'} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                      {show ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label htmlFor="j-confirm" className="block text-slate-400 text-sm font-medium mb-1.5">Confirm password</label>
                  <input id="j-confirm" type={show ? 'text' : 'password'} required minLength={8} maxLength={128} autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} className={inputCls} />
                </div>
                <button type="submit" disabled={busy} className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-semibold py-3 rounded-xl text-sm transition-colors mt-2">
                  {busy ? 'Joining…' : 'Join and sign in'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
