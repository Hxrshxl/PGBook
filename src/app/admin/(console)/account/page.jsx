'use client'
import { useState } from 'react'
import { useAdmin } from '@/context/AdminContext'
import { useToast } from '@/context/ToastContext'
import { adminApi } from '@/utils/adminApi'
import { useAsyncAction } from '@/hooks/useAsyncAction'
import FormError from '@/components/ui/FormError'
import { dateTime } from '@/components/admin/format'

const inputCls = 'w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-indigo-500'

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
    <div className="p-4 sm:p-6 lg:p-8 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">My Account</h1>
        <p className="text-slate-500 text-sm mt-1">Your PGBook staff account.</p>
      </div>

      <section className="bg-white rounded-2xl border border-slate-200 p-5">
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

      <form onSubmit={submit} className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
        <h2 className="font-semibold text-slate-900 text-sm">Change password</h2>
        <input type="password" required autoComplete="current-password" placeholder="Current password" aria-label="Current password" value={form.current} onChange={set('current')} className={inputCls} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input type="password" required minLength={12} autoComplete="new-password" placeholder="New password (12+ characters)" aria-label="New password" value={form.next} onChange={set('next')} className={inputCls} />
          <input type="password" required minLength={12} autoComplete="new-password" placeholder="Confirm new password" aria-label="Confirm new password" value={form.confirm} onChange={set('confirm')} className={inputCls} />
        </div>
        <FormError message={error} />
        <div className="flex justify-end">
          <button type="submit" disabled={busy} className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl disabled:opacity-50">
            {busy ? 'Changing…' : 'Change password'}
          </button>
        </div>
      </form>
    </div>
  )
}
