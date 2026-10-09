'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { UserPlus, CheckCircle2 } from 'lucide-react'
import { adminApi } from '@/utils/adminApi'
import FormError from '@/components/ui/FormError'

const inputCls = 'w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500'

export default function AcceptInvitePage() {
  const [token, setToken] = useState('')
  const [invite, setInvite] = useState(null)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('token') ?? ''
    setToken(t)
    adminApi.get(`/auth/invite?token=${encodeURIComponent(t)}`).then(setInvite).catch(err => setError(err.message))
  }, [])

  async function submit(e) {
    e.preventDefault()
    if (password.length < 12) return setError('Use at least 12 characters.')
    if (password !== confirm) return setError('Passwords do not match.')
    setBusy(true)
    setError('')
    try {
      await adminApi.post('/auth/invite', { token, password })
      setDone(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-5 py-12">
      <div className="w-full max-w-md bg-slate-900 border border-white/10 rounded-2xl p-8">
        {done ? (
          <div className="text-center space-y-4">
            <CheckCircle2 size={36} className="text-emerald-400 mx-auto" />
            <h1 className="text-lg font-bold text-white">Password set</h1>
            <p className="text-slate-400 text-sm">Next, sign in. You&apos;ll be asked to set up two-factor authentication — keep your phone handy.</p>
            <Link href="/admin/login" className="inline-block bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-5 py-2.5 rounded-xl text-sm">Go to sign-in</Link>
          </div>
        ) : invite ? (
          <form onSubmit={submit} className="space-y-4">
            <div className="flex items-center gap-2">
              <UserPlus size={18} className="text-indigo-400" />
              <h1 className="text-lg font-bold text-white">Join the PGBook admin team</h1>
            </div>
            <p className="text-slate-400 text-sm">Hi {invite.name}, you&apos;ve been invited as <strong className="text-white">{invite.role}</strong> ({invite.email}). Choose a password of at least 12 characters.</p>
            <input type="password" required minLength={12} autoComplete="new-password" placeholder="New password" aria-label="New password" value={password} onChange={e => setPassword(e.target.value)} className={inputCls} />
            <input type="password" required minLength={12} autoComplete="new-password" placeholder="Confirm password" aria-label="Confirm password" value={confirm} onChange={e => setConfirm(e.target.value)} className={inputCls} />
            <FormError message={error} />
            <button type="submit" disabled={busy} className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-semibold py-3 rounded-xl text-sm">
              {busy ? 'Saving…' : 'Set password'}
            </button>
          </form>
        ) : (
          <div className="space-y-4">
            <h1 className="text-lg font-bold text-white">Admin invite</h1>
            {error ? <FormError message={error} /> : <p className="text-slate-400 text-sm">Checking your invite…</p>}
          </div>
        )}
      </div>
    </div>
  )
}
