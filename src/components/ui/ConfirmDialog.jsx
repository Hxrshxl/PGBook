'use client'
import Modal from './Modal'
import FormError from './FormError'
import { useAsyncAction } from '@/hooks/useAsyncAction'
import { btn } from './styles'

/**
 * Generic confirmation dialog. `onConfirm` may be async; the dialog shows a
 * busy state and any error inline, and only closes on success.
 */
export default function ConfirmDialog({
  isOpen, title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel',
  tone = 'danger', onConfirm, onCancel, children,
}) {
  const { run, busy, error, setError } = useAsyncAction(onConfirm ?? (async () => {}))

  function handleCancel() {
    if (busy) return
    setError('')
    onCancel()
  }

  return (
    <Modal isOpen={isOpen} onClose={handleCancel} maxWidth="max-w-md">
      <h2 className="text-[15px] font-semibold text-slate-900">{title}</h2>
      {message && <div className="mt-1.5 text-sm leading-relaxed text-slate-600">{message}</div>}
      {children && <div className="mt-4">{children}</div>}
      {error && <div className="mt-4"><FormError message={error} /></div>}
      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button onClick={handleCancel} disabled={busy} className={btn.secondary}>{cancelLabel}</button>
        <button onClick={() => run()} disabled={busy} className={tone === 'danger' ? btn.danger : btn.primary}>
          {busy ? 'Please wait…' : confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
