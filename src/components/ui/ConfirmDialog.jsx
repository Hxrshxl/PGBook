'use client'
import { AlertTriangle, HelpCircle } from 'lucide-react'
import Modal from './Modal'
import FormError from './FormError'
import { useAsyncAction } from '@/hooks/useAsyncAction'

/**
 * Generic confirmation dialog. `onConfirm` may be async; the dialog shows a
 * busy state and any error inline, and only closes on success.
 */
export default function ConfirmDialog({
  isOpen, title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel',
  tone = 'danger', onConfirm, onCancel, children,
}) {
  const { run, busy, error, setError } = useAsyncAction(onConfirm ?? (async () => {}))
  const danger = tone === 'danger'

  function handleCancel() {
    if (busy) return
    setError('')
    onCancel()
  }

  return (
    <Modal isOpen={isOpen} onClose={handleCancel} maxWidth="max-w-sm">
      <div className="text-center">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 ${danger ? 'bg-red-100' : 'bg-indigo-100'}`}>
          {danger ? <AlertTriangle size={22} className="text-red-600" /> : <HelpCircle size={22} className="text-indigo-600" />}
        </div>
        <h2 className="text-slate-900 font-bold text-lg mb-2">{title}</h2>
        {message && <div className="text-slate-500 text-sm mb-5">{message}</div>}
        {children && <div className="text-left mb-5">{children}</div>}
        {error && <div className="mb-4 text-left"><FormError message={error} /></div>}
        <div className="flex gap-3">
          <button
            onClick={handleCancel}
            disabled={busy}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-600 border border-slate-200 rounded-xl hover:border-slate-300 transition-colors disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            onClick={() => run()}
            disabled={busy}
            className={`flex-1 px-4 py-2.5 text-sm font-semibold text-white rounded-xl transition-colors disabled:opacity-60 ${danger ? 'bg-red-600 hover:bg-red-500' : 'bg-indigo-600 hover:bg-indigo-500'}`}
          >
            {busy ? 'Please wait…' : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  )
}
