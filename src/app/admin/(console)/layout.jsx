'use client'
import { AdminProvider } from '@/context/AdminContext'
import AdminShell from '@/components/admin/AdminShell'

export default function AdminConsoleLayout({ children }) {
  return (
    <AdminProvider>
      <AdminShell>{children}</AdminShell>
    </AdminProvider>
  )
}
