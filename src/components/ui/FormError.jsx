'use client'
import { AlertCircle } from 'lucide-react'

export default function FormError({ message }) {
  if (!message) return null
  return (
    <div role="alert" className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5">
      <AlertCircle size={15} className="text-red-500 shrink-0 mt-0.5" />
      <p className="text-red-700 text-sm">{message}</p>
    </div>
  )
}
