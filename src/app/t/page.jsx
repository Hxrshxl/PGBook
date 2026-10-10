'use client'
import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { api } from '@/utils/api'
import AuthShell, { AuthError } from '@/components/ui/AuthShell'
import { button, field } from '@/components/ui/styles'

// 16px text so phones don't zoom into the field.
const inputCls = 'w-full h-11 rounded-md border border-slate-200 bg-white px-3 text-base text-slate-900 placeholder:text-slate-400 shadow-xs focus:outline-none focus:border-indigo-500'

// Tenant sign-in: phone number → 6-digit code. No passwords.
export default function TenantLoginPage() {
  const [step, setStep] = useState('phone')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [info, setInfo] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function requestCode(e) {
    e?.preventDefault()
    setError('')
    setBusy(true)
    try {
      const data = await api.post('/resident/otp', { phone })
      setInfo(data)
      setStep('code')
      if (data.devCode) setCode(data.devCode)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function verify(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await api.post('/resident/verify', { phone, code })
      window.location.replace('/t/home')
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <AuthShell
      title="Sign in as a tenant"
      subtitle="See your rent, pay by UPI, download receipts and raise complaints."
      footer={<>PG owner or staff? <Link href="/login" className="font-medium text-slate-900 underline-offset-4 hover:underline">Sign in here</Link></>}
    >
      <AuthError message={error} />
      {step === 'phone' ? (
        <form onSubmit={requestCode} className="space-y-5">
          <div>
            <label htmlFor="t-phone" className={field.label}>Mobile number</label>
            <div className="flex">
              <span className="inline-flex h-11 items-center rounded-l-md border border-r-0 border-slate-200 bg-slate-50 px-3 text-base text-slate-500">+91</span>
              <input id="t-phone" type="tel" inputMode="numeric" autoComplete="tel-national" required value={phone} onChange={e => setPhone(e.target.value)}
                placeholder="98765 43210" className={`${inputCls} rounded-l-none`} />
            </div>
            <p className={field.help}>Use the number your PG has on record. We will text you a 6-digit code.</p>
          </div>
          <button type="submit" disabled={busy} className={`${button('primary', 'lg')} h-11 w-full`}>{busy ? 'Sending…' : 'Send code'}</button>
        </form>
      ) : (
        <form onSubmit={verify} className="space-y-5">
          <p className="text-sm text-slate-600">{info?.message}</p>
          {info?.devNote && <p className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-600">{info.devNote}</p>}
          <div>
            <label htmlFor="t-code" className={field.label}>6-digit code</label>
            <input id="t-code" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} required autoFocus value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
              className={`${inputCls} text-center text-lg font-semibold tracking-[0.5em]`} />
          </div>
          <button type="submit" disabled={busy || code.length !== 6} className={`${button('primary', 'lg')} h-11 w-full`}>{busy ? 'Checking…' : 'Sign in'}</button>
          <div className="flex justify-between text-sm">
            <button type="button" onClick={() => { setStep('phone'); setCode(''); setError('') }} className="flex items-center gap-1 text-slate-500 hover:text-slate-800"><ArrowLeft size={14} /> Change number</button>
            <button type="button" onClick={requestCode} disabled={busy} className="font-medium text-slate-900 hover:underline disabled:opacity-50">Resend code</button>
          </div>
        </form>
      )}
    </AuthShell>
  )
}
