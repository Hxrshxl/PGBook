'use client'
import { useState } from 'react'
import Modal from '@/components/ui/Modal'
import FormError from '@/components/ui/FormError'
import { useAsyncAction } from '@/hooks/useAsyncAction'

/**
 * Confirmation that requires a written reason (stored in the audit log and,
 * for owner-account actions, shown to the owner). onSubmit({ reason, ...fields }) may throw.
 */
export default function ReasonDialog({ isOpen, title, description, confirmLabel = 'Confirm', tone = 'primary', reasonLabel = 'Reason', reasonHint, onSubmit, onClose, children, fields = {} }) {
  const [reason, setReason] = useState('')
  const { run, busy, error, setError } = useAsyncAction(onSubmit)

  function close() {
    if (busy) return
    setReason('')
    setError('')
    onClose()
  }

  async function submit(e) {
    e.preventDefault()
    const result = await run({ reason: reason.trim(), ...fields })
    if (result !== undefined) setReason('')
  }

  const danger = tone === 'danger'
  return (
    <Modal isOpen={isOpen} onClose={close} title={title} maxWidth="max-w-md">
      <form onSubmit={submit} className="space-y-4">
        {description && <div className="text-sm text-slate-600">{description}</div>}
        {children}
        <div>
          <label htmlFor="reason" className="block text-slate-700 text-sm font-medium mb-1.5">{reasonLabel} *</label>
          <textarea id="reason" required minLength={3} maxLength={1000} rows={3} value={reason} onChange={e => setReason(e.target.value)}
            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-indigo-500 resize-none" />
          <p className="text-xs text-slate-400 mt-1">{reasonHint ?? 'Kept permanently in the audit log.'}</p>
        </div>
        <FormError message={error} />
        <div className="flex justify-end gap-3 pt-1">
          <button type="button" onClick={close} disabled={busy} className="px-4 py-2.5 text-sm font-medium text-slate-600 border border-slate-200 rounded-xl hover:border-slate-300 disabled:opacity-50">Cancel</button>
          <button type="submit" disabled={busy || reason.trim().length < 3}
            className={`px-5 py-2.5 text-sm font-semibold text-white rounded-xl disabled:opacity-50 ${danger ? 'bg-rose-600 hover:bg-rose-500' : 'bg-indigo-600 hover:bg-indigo-700'}`}>
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </form>
    </Modal>
  )
}
