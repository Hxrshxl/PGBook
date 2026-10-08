'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ShieldCheck, Smartphone, KeyRound } from 'lucide-react'
import { adminApi } from '@/utils/adminApi'
import FormError from '@/components/ui/FormError'

const inputCls = 'w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-indigo-500'
const codeCls = 'w-full text-center tracking-[0.5em] text-2xl font-semibold bg-white/5 border border-white/10 rounded-xl px-3 py-3 text-white focus:outline-none focus:border-indigo-500'

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

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-5 py-12">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2 mb-8">
          <span className="text-white font-bold text-2xl" style={{ fontFamily: 'Space Grotesk' }}>PG<span className="text-indigo-400">Book</span></span>
          <span className="text-[10px] font-bold tracking-wider px-1.5 py-0.5 rounded bg-rose-500/90 text-white">ADMIN</span>
        </div>

        <div className="bg-slate-900 border border-white/10 rounded-2xl p-8">
          {notice && step === 'credentials' && <p className="text-amber-300 text-sm bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 mb-5">{notice}</p>}

          {step === 'credentials' && (
            <form onSubmit={submitCredentials} className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <KeyRound size={18} className="text-indigo-400" />
                <h1 className="text-lg font-bold text-white">Staff sign-in</h1>
              </div>
              <p className="text-slate-400 text-sm -mt-2 mb-4">For PGBook team members only. PG owners sign in <Link href="/login" className="text-indigo-400 hover:text-indigo-300">here</Link>.</p>
              <div>
                <label htmlFor="a-email" className="block text-slate-400 text-sm font-medium mb-1.5">Work email</label>
                <input id="a-email" type="email" required autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label htmlFor="a-password" className="block text-slate-400 text-sm font-medium mb-1.5">Password</label>
                <input id="a-password" type="password" required autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} className={inputCls} />
              </div>
              {error && <FormError message={error} />}
              <button type="submit" disabled={busy} className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-semibold py-3 rounded-xl text-sm">
                {busy ? 'Checking…' : 'Continue'}
              </button>
            </form>
          )}

          {step === 'totp' && (
            <form onSubmit={submitCode} className="space-y-5 text-center">
              <ShieldCheck size={32} className="text-indigo-400 mx-auto" />
              <div>
                <h1 className="text-lg font-bold text-white">Two-factor authentication</h1>
                <p className="text-slate-400 text-sm mt-1">Enter the 6-digit code from your authenticator app.</p>
              </div>
              <CodeInput value={code} onChange={setCode} />
              {error && <div className="text-left"><FormError message={error} /></div>}
              <button type="submit" disabled={busy || code.length !== 6} className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold py-3 rounded-xl text-sm">
                {busy ? 'Verifying…' : 'Sign in'}
              </button>
              <button type="button" onClick={() => { setStep('credentials'); setError('') }} className="text-xs text-slate-500 hover:text-slate-300">Start over</button>
            </form>
          )}

          {step === 'enroll' && (
            <form onSubmit={submitCode} className="space-y-5">
              <div className="flex items-center gap-2">
                <Smartphone size={18} className="text-indigo-400" />
                <h1 className="text-lg font-bold text-white">Set up two-factor authentication</h1>
              </div>
              <p className="text-slate-400 text-sm">2FA is required for every PGBook admin. Scan this QR code with Google Authenticator, Microsoft Authenticator, Authy or 1Password, then enter the 6-digit code it shows.</p>
              {enrollment ? (
                <div className="flex flex-col items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={enrollment.qr} alt="QR code for your authenticator app" width={220} height={220} className="rounded-xl bg-white p-2" />
                  <p className="text-xs text-slate-500 text-center">Can&apos;t scan? Enter this key manually:</p>
                  <code className="text-sm text-indigo-300 bg-white/5 rounded-lg px-3 py-1.5 tracking-wider select-all break-all text-center">{enrollment.secret}</code>
                </div>
              ) : (
                <p className="text-slate-500 text-sm text-center">Preparing…</p>
              )}
              <CodeInput value={code} onChange={setCode} />
              {error && <FormError message={error} />}
              <button type="submit" disabled={busy || code.length !== 6 || !enrollment} className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold py-3 rounded-xl text-sm">
                {busy ? 'Verifying…' : 'Turn on 2FA and sign in'}
              </button>
            </form>
          )}
        </div>
        <p className="text-center text-xs text-slate-600 mt-6">Sign-ins and every admin action are recorded.</p>
      </div>
    </div>
  )
}
