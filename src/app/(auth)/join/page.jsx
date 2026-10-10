'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Eye, EyeOff } from 'lucide-react'
import AuthShell, { AuthError } from '@/components/ui/AuthShell'
import { btn, field } from '@/components/ui/styles'
import { api } from '@/utils/api'
import Spinner from '@/components/ui/Spinner'


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

  if (loadError) {
    return (
      <AuthShell title="Invite link not valid" footer={<>Already joined? <Link href="/login" className="font-medium text-slate-900 underline-offset-4 hover:underline">Sign in</Link></>}>
        <AuthError message={loadError} />
      </AuthShell>
    )
  }
  if (!invite) {
    return <AuthShell title="Joining…"><div className="flex py-6"><Spinner size={22} /></div></AuthShell>
  }

  return (
    <AuthShell
      title={`Join ${invite.pgName || `${invite.owner}'s PG`}`}
      subtitle={<>{invite.owner} invited you as <span className="font-medium text-slate-900">{invite.role}</span>. Set a password to finish.</>}
    >
      <AuthError message={error} />
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="j-email" className={field.label}>Email</label>
          <input id="j-email" readOnly disabled value={invite.email} className={field.input} />
        </div>
        <div>
          <label htmlFor="j-name" className={field.label}>Your name</label>
          <input id="j-name" required maxLength={100} value={name} onChange={e => setName(e.target.value)} className={field.input} />
        </div>
        <div>
          <label htmlFor="j-pw" className={field.label}>Password</label>
          <div className="relative">
            <input id="j-pw" type={show ? 'text' : 'password'} required minLength={8} maxLength={128} autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} className={`${field.input} pr-9`} />
            <button type="button" onClick={() => setShow(v => !v)} aria-label={show ? 'Hide password' : 'Show password'} className="absolute right-1.5 top-1/2 -translate-y-1/2 inline-flex h-7 w-7 items-center justify-center rounded text-slate-400 hover:text-slate-700">
              {show ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
          <p className={field.help}>At least 8 characters.</p>
        </div>
        <div>
          <label htmlFor="j-confirm" className={field.label}>Confirm password</label>
          <input id="j-confirm" type={show ? 'text' : 'password'} required minLength={8} maxLength={128} autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} className={field.input} />
        </div>
        <button type="submit" disabled={busy} className={`${btn.primary} w-full`}>{busy ? 'Joining…' : 'Join and sign in'}</button>
      </form>
    </AuthShell>
  )
}
