'use client'
import { AlertTriangle } from 'lucide-react'
import Modal from '../ui/Modal'

export default function DeleteConfirmDialog({ tenant, onConfirm, onCancel }) {
  return (
    <Modal isOpen={!!tenant} onClose={onCancel} maxWidth="max-w-sm">
      <div className="text-center">
        <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle size={22} className="text-red-600" />
        </div>
        <h2 className="text-slate-900 font-bold text-lg mb-2" style={{ fontFamily: 'Space Grotesk' }}>
          Remove {tenant?.name}?
        </h2>
        <p className="text-slate-500 text-sm mb-6">
          <span className="font-medium text-slate-700">{tenant?.name}</span> (Room{' '}
          <span className="font-medium text-slate-700">{tenant?.room}</span>) will be marked as vacated today.
          Payment history is preserved.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-600 border border-slate-200 rounded-xl hover:border-slate-300 transition-colors"
          >
            Keep tenant
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-500 rounded-xl transition-colors"
          >
            Yes, remove
          </button>
        </div>
      </div>
    </Modal>
  )
}
