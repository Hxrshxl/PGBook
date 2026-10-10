'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { adminApi } from '@/utils/adminApi'
import AuthShell, { AuthError } from '@/components/ui/AuthShell'
import { button, field } from '@/components/ui/styles'

const inputCls = field.input
const codeCls = 'w-full h-12 rounded-md border border-slate-200 bg-white px-3 text-center text-2xl font-semibold tracking-[0.5em] text-slate-900 shadow-xs focus:outline-none focus:border-indigo-500'
const submitCls = `${button('primary', 'lg')} w-full`

function goNext() {
  const next = new URLSearchParams(window.location.search).get('next')
  window.location.assign(next && next.startsWith('/admin') && !next.startsWith('/admin/login') ? next : '/admin')
}

function CodeInput({ value, onChange }) {
  return (
    <input autoFocus inputMode="numeric" autoComplete="one-time-code" maxLength={6} aria-label="6-digit code" placeholder="123456"
      value={value} onChange={e => onChange(e.target.value.replace(/\D/g, ''))} className={codeCls} />
  )
}

export default function AdminLoginPage() {
  const [step, setStep] = useState('credentials') // credentials | totp | enroll
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [enrollment, setEnrollment] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('expired')) {
      setNotice('Your admin session ended. Please sign in again.')
    }
  }, [])

  useEffect(() => {
    if (step !== 'enroll') return
    adminApi.get('/auth/enroll').then(setEnrollment).catch(err => { setError(err.message); setStep('credentials') })
  }, [step])

  async function attempt(fn) {
    setBusy(true)
    setError('')
    try {
      await fn()
    } catch (err) {
      setError(err.message)
      if (/expired/i.test(err.message)) setStep('credentials')
    } finally {
      setBusy(false)
    }
  }

  const submitCredentials = e => {
    e.preventDefault()
    attempt(async () => {
      const { next } = await adminApi.post('/auth/login', { email, password })
      setPassword('')
      setCode('')
      setStep(next)
    })
  }

  const submitCode = e => {
    e.preventDefault()
    attempt(async () => {
      await adminApi.post(step === 'enroll' ? '/auth/enroll' : '/auth/verify', { code })
      goNext()
    })
  }

  const titles = {
    credentials: ['PGBook staff sign-in', <>For the PGBook team only. PG owners sign in <Link href="/login" className="font-medium text-slate-900 underline-offset-4 hover:underline">here</Link>.</>],
    totp: ['Two-factor authentication', 'Enter the 6-digit code from your authenticator app.'],
    enroll: ['Set up two-factor authentication', '2FA is required for every PGBook admin.'],
  }
  const [title, subtitle] = titles[step]

  return (
    <AuthShell title={title} subtitle={subtitle} footer="Sign-ins and every admin action are recorded.">
      {notice && step === 'credentials' && <p className="mb-5 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">{notice}</p>}

      {step === 'credentials' && (
        <form onSubmit={submitCredentials} className="space-y-5">
          <div>
            <label htmlFor="a-email" className={field.label}>Work email</label>
            <input id="a-email" type="email" required autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label htmlFor="a-password" className={field.label}>Password</label>
            <input id="a-password" type="password" required autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} className={inputCls} />
          </div>
          <AuthError message={error} />
          <button type="submit" disabled={busy} className={submitCls}>{busy ? 'Checking…' : 'Continue'}</button>
        </form>
      )}

      {step === 'totp' && (
        <form onSubmit={submitCode} className="space-y-5">
          <CodeInput value={code} onChange={setCode} />
          <AuthError message={error} />
          <button type="submit" disabled={busy || code.length !== 6} className={submitCls}>{busy ? 'Verifying…' : 'Sign in'}</button>
          <button type="button" onClick={() => { setStep('credentials'); setError('') }} className="text-sm text-slate-500 hover:text-slate-800">Start over</button>
        </form>
      )}

      {step === 'enroll' && (
        <form onSubmit={submitCode} className="space-y-5">
          <p className="text-sm text-slate-600">Scan this QR code with Google Authenticator, Microsoft Authenticator, Authy or 1Password, then enter the 6-digit code it shows.</p>
          {enrollment ? (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-slate-200 p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={enrollment.qr} alt="QR code for your authenticator app" width={200} height={200} />
              <p className="text-xs text-slate-500">Can&apos;t scan? Enter this key manually:</p>
              <code className="select-all break-all rounded-md bg-slate-100 px-3 py-1.5 text-center font-mono text-sm tracking-wider text-slate-900">{enrollment.secret}</code>
            </div>
          ) : (
            <p className="text-center text-sm text-slate-500">Preparing…</p>
          )}
          <CodeInput value={code} onChange={setCode} />
          <AuthError message={error} />
          <button type="submit" disabled={busy || code.length !== 6 || !enrollment} className={submitCls}>{busy ? 'Verifying…' : 'Turn on 2FA and sign in'}</button>
        </form>
      )}
    </AuthShell>
  )
}
