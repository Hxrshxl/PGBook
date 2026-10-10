'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import AuthShell, { AuthError } from '@/components/ui/AuthShell'
import { btn, field } from '@/components/ui/styles'

export default function LoginPage() {
  const router = useRouter()
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      // Only follow internal dashboard links, never arbitrary URLs (open redirect).
      const next = new URLSearchParams(window.location.search).get('next')
      router.replace(next && next.startsWith('/dashboard') ? next : '/dashboard')
    } catch (err) {
      setError(err.message ?? 'Could not sign in.')
      setLoading(false)
    }
  }

  return (
    <AuthShell
      title="Sign in to PGBook"
      subtitle="For PG owners and their staff."
      footer={<>
        New to PGBook? <Link href="/signup" className="font-medium text-slate-900 underline-offset-4 hover:underline">Start a free trial</Link>
        <span className="mx-2 text-slate-300">·</span>
        Tenant? <Link href="/t" className="font-medium text-slate-900 underline-offset-4 hover:underline">Sign in with your phone</Link>
      </>}
    >
      <AuthError message={error} />
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className={field.label}>Email</label>
          <input id="email" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" className={field.input} />
        </div>
        <div>
          <label htmlFor="password" className={field.label}>Password</label>
          <div className="relative">
            <input id="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} className={`${field.input} pr-9`} />
            <button type="button" onClick={() => setShowPassword(v => !v)} aria-label={showPassword ? 'Hide password' : 'Show password'} className="absolute right-1.5 top-1/2 -translate-y-1/2 inline-flex h-7 w-7 items-center justify-center rounded text-slate-400 hover:text-slate-700">
              {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </div>
        <button type="submit" disabled={loading} className={`${btn.primary} w-full`}>
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </AuthShell>
  )
}
