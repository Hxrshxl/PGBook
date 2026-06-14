'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Building2, Eye, EyeOff, AlertCircle } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'

export default function SignupPage() {
  const router = useRouter()
  const { signup } = useAuth()
  const [form, setForm] = useState({ name: '', pgName: '', email: '', password: '', confirm: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const update = (k, v) => setForm(prev => ({ ...prev, [k]: v }))

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (form.password !== form.confirm) return setError('Passwords do not match.')
    if (form.password.length < 6) return setError('Password must be at least 6 characters.')
    setLoading(true)
    try {
      await signup({ name: form.name, pgName: form.pgName, email: form.email, password: form.password })
      router.push('/dashboard')
    } catch (err) {
      setError(err.message ?? 'Signup failed.')
      setLoading(false)
    }
  }

  const inputCls = 'w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors'

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
          <h1 className="text-xl font-bold text-white mb-1">Start your free trial</h1>
          <p className="text-slate-400 text-sm mb-6">14 days free · No credit card required</p>

          {error && (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 mb-5">
              <AlertCircle size={16} className="text-red-400 shrink-0" />
              <p className="text-red-300 text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 text-sm font-medium mb-1.5">Your name</label>
                <input type="text" required value={form.name} onChange={e => update('name', e.target.value)} placeholder="Ramesh Kumar" className={inputCls} />
              </div>
              <div>
                <label className="block text-slate-400 text-sm font-medium mb-1.5">PG name</label>
                <input type="text" value={form.pgName} onChange={e => update('pgName', e.target.value)} placeholder="Kumar's PG" className={inputCls} />
              </div>
            </div>
            <div>
              <label className="block text-slate-400 text-sm font-medium mb-1.5">Email address</label>
              <input type="email" required value={form.email} onChange={e => update('email', e.target.value)} placeholder="you@example.com" className={`${inputCls} px-4`} />
            </div>
            <div>
              <label className="block text-slate-400 text-sm font-medium mb-1.5">Password</label>
              <div className="relative">
                <input type={showPassword ? 'text' : 'password'} required value={form.password} onChange={e => update('password', e.target.value)} placeholder="Min. 6 characters" className={`${inputCls} px-4 pr-10`} />
                <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-slate-400 text-sm font-medium mb-1.5">Confirm password</label>
              <input type="password" required value={form.confirm} onChange={e => update('confirm', e.target.value)} placeholder="Re-enter password" className={`${inputCls} px-4`} />
            </div>
            <button type="submit" disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-semibold py-3 rounded-xl text-sm transition-colors mt-2">
              {loading ? 'Creating account…' : 'Create account'}
            </button>
          </form>

          <p className="text-slate-500 text-sm text-center mt-6">
            Already have an account?{' '}
            <Link href="/login" className="text-indigo-400 hover:text-indigo-300 font-medium">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
