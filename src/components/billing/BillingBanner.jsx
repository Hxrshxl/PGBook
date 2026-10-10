'use client'
import Link from 'next/link'
import { AlertTriangle, Info, Lock } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'

const STYLES = {
  info: ['bg-indigo-50 border-indigo-100 text-indigo-900', Info],
  warning: ['bg-amber-50 border-amber-200 text-amber-900', AlertTriangle],
  danger: ['bg-red-50 border-red-200 text-red-900', Lock],
}

// Trial ending, payment failed, or read-only — shown on every dashboard page.
export default function BillingBanner() {
  const { access } = useAuth()
  const notice = access?.billing?.notice
  if (!notice) return null
  const [cls, Icon] = STYLES[notice.tone] ?? STYLES.info
  return (
    <div className={`flex items-center gap-2.5 border-b px-4 sm:px-6 py-2 text-[13px] ${cls}`} role={notice.tone === 'danger' ? 'alert' : 'status'}>
      <Icon size={14} className="shrink-0" />
      <p className="flex-1">{notice.text}</p>
      {access.role === 'owner' && (
        <Link href="/dashboard/billing" className="shrink-0 font-medium underline underline-offset-2 hover:no-underline">Manage subscription</Link>
      )}
    </div>
  )
}
