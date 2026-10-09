'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Building2, AlertCircle, ArrowLeft } from 'lucide-react'
import { api } from '@/utils/api'

const inputCls = 'w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-base text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500'

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
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <div className="flex-1 flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-sm">
          <div className="flex items-center justify-center gap-2.5 mb-8">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center"><Building2 size={20} className="text-white" /></div>
            <span style={{ fontFamily: 'Space Grotesk' }} className="text-slate-900 font-bold text-2xl tracking-tight">PG<span className="text-indigo-600">Book</span></span>
          </div>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <h1 className="text-xl font-bold text-slate-900">For tenants</h1>
            <p className="text-slate-500 text-sm mt-1 mb-5">See your rent, pay by UPI, download receipts and raise complaints.</p>

            {error && (
              <div role="alert" className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5 mb-4">
                <AlertCircle size={15} className="text-red-500 shrink-0 mt-0.5" /><p className="text-red-700 text-sm">{error}</p>
              </div>
            )}

            {step === 'phone' ? (
              <form onSubmit={requestCode} className="space-y-4">
                <div>
                  <label htmlFor="t-phone" className="block text-slate-700 text-sm font-medium mb-1.5">Mobile number</label>
                  <div className="flex">
                    <span className="inline-flex items-center px-3 rounded-l-xl border border-r-0 border-slate-200 bg-slate-50 text-slate-500 text-base">+91</span>
                    <input id="t-phone" type="tel" inputMode="numeric" autoComplete="tel-national" required value={phone} onChange={e => setPhone(e.target.value)}
                      placeholder="98765 43210" className={`${inputCls} rounded-l-none`} />
                  </div>
                  <p className="text-xs text-slate-400 mt-1.5">Use the number your PG has on record.</p>
                </div>
                <button type="submit" disabled={busy} className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-semibold py-3 rounded-xl text-sm">{busy ? 'Sending…' : 'Send code'}</button>
              </form>
            ) : (
              <form onSubmit={verify} className="space-y-4">
                <p className="text-sm text-slate-600">{info?.message}</p>
                {info?.devNote && <p className="text-xs text-violet-700 bg-violet-50 border border-violet-200 rounded-lg px-3 py-2">{info.devNote}</p>}
                <div>
                  <label htmlFor="t-code" className="block text-slate-700 text-sm font-medium mb-1.5">6-digit code</label>
                  <input id="t-code" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} required autoFocus value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                    className={`${inputCls} tracking-[0.5em] text-center text-lg font-semibold`} />
                </div>
                <button type="submit" disabled={busy || code.length !== 6} className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-semibold py-3 rounded-xl text-sm">{busy ? 'Checking…' : 'Sign in'}</button>
                <div className="flex justify-between text-sm">
                  <button type="button" onClick={() => { setStep('phone'); setCode(''); setError('') }} className="flex items-center gap-1 text-slate-500 hover:text-slate-700"><ArrowLeft size={14} /> Change number</button>
                  <button type="button" onClick={requestCode} disabled={busy} className="text-indigo-600 hover:text-indigo-500 font-medium disabled:opacity-50">Resend code</button>
                </div>
              </form>
            )}
          </div>
          <p className="text-center text-xs text-slate-400 mt-6">PG owner? <Link href="/login" className="text-indigo-600 font-medium">Sign in here</Link></p>
        </div>
      </div>
    </div>
  )
}
