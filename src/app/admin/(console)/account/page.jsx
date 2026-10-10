'use client'
import { useState } from 'react'
import { useAdmin } from '@/context/AdminContext'
import { useToast } from '@/context/ToastContext'
import { adminApi } from '@/utils/adminApi'
import { useAsyncAction } from '@/hooks/useAsyncAction'
import FormError from '@/components/ui/FormError'
import { dateTime } from '@/components/admin/format'

const inputCls = 'w-full border border-slate-200 rounded-md px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-indigo-500 bg-white'

export default function MyAccountPage() {
  const { admin } = useAdmin()
  const { showToast } = useToast()
  const [form, setForm] = useState({ current: '', next: '', confirm: '' })
  const set = k => e => setForm(prev => ({ ...prev, [k]: e.target.value }))
  const { run, busy, error, setError } = useAsyncAction(async () => {
    await adminApi.put('/auth/password', { currentPassword: form.current, newPassword: form.next })
    setForm({ current: '', next: '', confirm: '' })
    showToast('Password changed. Your other sessions were signed out.')
  })

  function submit(e) {
    e.preventDefault()
    if (form.next.length < 12) return setError('Use at least 12 characters.')
    if (form.next !== form.confirm) return setError('New passwords do not match.')
    run()
  }

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">My account</h1>
        <p className="text-slate-500 text-sm mt-1">Your PGBook staff account.</p>
      </div>

      <section className="bg-white rounded-xl border border-slate-200 p-5">
        <dl className="space-y-2 text-sm">
          {[
            ['Name', admin.name],
            ['Email', admin.email],
            ['Role', admin.roleLabel],
            ['Two-factor', admin.twoFactorEnabled ? `On since ${dateTime(admin.totpEnabledAt)}` : 'Not set up'],
            ['Last sign-in', `${dateTime(admin.lastLoginAt)}${admin.lastLoginIp ? ` from ${admin.lastLoginIp}` : ''}`],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4">
              <dt className="text-slate-500">{k}</dt>
              <dd className="text-slate-900 text-right">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="text-xs text-slate-400 mt-4">Lost your phone? Ask another Super Admin to reset your 2FA from Admin Team.</p>
      </section>

      <form onSubmit={submit} className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <h2 className="font-semibold text-slate-900 text-sm">Change password</h2>
        <input type="password" required autoComplete="current-password" placeholder="Current password" aria-label="Current password" value={form.current} onChange={set('current')} className={inputCls} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input type="password" required minLength={12} autoComplete="new-password" placeholder="New password (12+ characters)" aria-label="New password" value={form.next} onChange={set('next')} className={inputCls} />
          <input type="password" required minLength={12} autoComplete="new-password" placeholder="Confirm new password" aria-label="Confirm new password" value={form.confirm} onChange={set('confirm')} className={inputCls} />
        </div>
        <FormError message={error} />
        <div className="flex justify-end">
          <button type="submit" disabled={busy} className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap h-9 px-3.5 text-sm rounded-md bg-indigo-600 font-medium text-white shadow-xs transition-colors hover:bg-indigo-700 disabled:opacity-50">
            {busy ? 'Changing…' : 'Change password'}
          </button>
        </div>
      </form>
    </div>
  )
}
