'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import AuthShell, { AuthError } from '@/components/ui/AuthShell'
import { btn, field } from '@/components/ui/styles'

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
    if (form.password.length < 8) return setError('Password must be at least 8 characters.')
    setLoading(true)
    try {
      await signup({ name: form.name, pgName: form.pgName, email: form.email, password: form.password })
      router.replace('/dashboard')
    } catch (err) {
      setError(err.message ?? 'Could not create your account.')
      setLoading(false)
    }
  }

  return (
    <AuthShell
      title="Start your free trial"
      subtitle="14 days with every feature. No card needed."
      footer={<>Already have an account? <Link href="/login" className="font-medium text-slate-900 underline-offset-4 hover:underline">Sign in</Link></>}
    >
      <AuthError message={error} />
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="name" className={field.label}>Your name</label>
            <input id="name" type="text" autoComplete="name" required value={form.name} onChange={e => update('name', e.target.value)} className={field.input} />
          </div>
          <div>
            <label htmlFor="pgName" className={field.label}>PG name</label>
            <input id="pgName" type="text" value={form.pgName} onChange={e => update('pgName', e.target.value)} placeholder="Sunrise PG" className={field.input} />
          </div>
        </div>
        <div>
          <label htmlFor="email" className={field.label}>Email</label>
          <input id="email" type="email" autoComplete="email" required value={form.email} onChange={e => update('email', e.target.value)} placeholder="you@example.com" className={field.input} />
        </div>
        <div>
          <label htmlFor="password" className={field.label}>Password</label>
          <div className="relative">
            <input id="password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" required minLength={8} value={form.password} onChange={e => update('password', e.target.value)} className={`${field.input} pr-9`} />
            <button type="button" onClick={() => setShowPassword(v => !v)} aria-label={showPassword ? 'Hide password' : 'Show password'} className="absolute right-1.5 top-1/2 -translate-y-1/2 inline-flex h-7 w-7 items-center justify-center rounded text-slate-400 hover:text-slate-700">
              {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
          <p className={field.help}>At least 8 characters.</p>
        </div>
        <div>
          <label htmlFor="confirm" className={field.label}>Confirm password</label>
          <input id="confirm" type="password" autoComplete="new-password" required value={form.confirm} onChange={e => update('confirm', e.target.value)} className={field.input} />
        </div>
        <button type="submit" disabled={loading} className={`${btn.primary} w-full`}>
          {loading ? 'Creating account…' : 'Create account'}
        </button>
        <p className="text-xs leading-relaxed text-slate-500">By creating an account you agree to keep your tenants&apos; data accurate and to use it only to run your PG.</p>
      </form>
    </AuthShell>
  )
}
