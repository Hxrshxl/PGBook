'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { adminApi } from '@/utils/adminApi'
import AuthShell, { AuthError } from '@/components/ui/AuthShell'
import { button, field } from '@/components/ui/styles'

const inputCls = field.input

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

  if (done) {
    return (
      <AuthShell title="Password set" subtitle="Next, sign in. You'll be asked to set up two-factor authentication, so keep your phone handy.">
        <Link href="/admin/login" className={`${button('primary', 'lg')} w-full`}>Go to sign-in</Link>
      </AuthShell>
    )
  }
  if (!invite) {
    return (
      <AuthShell title="Admin invite">
        {error ? <AuthError message={error} /> : <p className="text-sm text-slate-500">Checking your invite…</p>}
      </AuthShell>
    )
  }
  return (
    <AuthShell
      title="Join the PGBook admin team"
      subtitle={<>Hi {invite.name}, you&apos;ve been invited as <strong className="font-medium text-slate-900">{invite.role}</strong> ({invite.email}).</>}
    >
      <form onSubmit={submit} className="space-y-5">
        <div>
          <label htmlFor="inv-pw" className={field.label}>New password</label>
          <input id="inv-pw" type="password" required minLength={12} autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} className={inputCls} />
          <p className={field.help}>At least 12 characters.</p>
        </div>
        <div>
          <label htmlFor="inv-pw2" className={field.label}>Confirm password</label>
          <input id="inv-pw2" type="password" required minLength={12} autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} className={inputCls} />
        </div>
        <AuthError message={error} />
        <button type="submit" disabled={busy} className={`${button('primary', 'lg')} w-full`}>{busy ? 'Saving…' : 'Set password'}</button>
      </form>
    </AuthShell>
  )
}
