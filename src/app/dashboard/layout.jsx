'use client'
import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { AlertCircle, Lock, RefreshCw } from 'lucide-react'
import { capabilityFor } from '@/utils/dashboardRoutes'
import { useAuth } from '@/context/AuthContext'
import { AppProvider, useAppData } from '@/context/AppContext'
import Sidebar from '@/components/layout/Sidebar'
import TopBar from '@/components/layout/TopBar'
import Spinner from '@/components/ui/Spinner'
import BillingBanner from '@/components/billing/BillingBanner'

function FullScreenSpinner() {
  return (
    <div className="flex h-full min-h-[50vh] items-center justify-center">
      <Spinner size={28} />
    </div>
  )
}

// Shows a spinner / error state until the owner's data has loaded,
// instead of flashing "no tenants" empty states.
function DataGate({ children }) {
  const { loading, error, reload } = useAppData()
  const { can, access } = useAuth()
  const pathname = usePathname()
  const needed = capabilityFor(pathname)
  if (needed && !can(needed)) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-24 px-6">
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500">
          <Lock size={18} strokeWidth={1.75} />
        </div>
        <h2 className="text-sm font-semibold text-slate-900 mb-1">Not available for your role</h2>
        <p className="text-slate-500 text-sm max-w-sm">As {access?.roleLabel ?? 'a team member'}, you don&apos;t have access to this page. Ask the owner if you need it.</p>
      </div>
    )
  }
  if (loading) return <FullScreenSpinner />
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-24 px-6">
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-600">
          <AlertCircle size={18} strokeWidth={1.75} />
        </div>
        <h2 className="text-sm font-semibold text-slate-900 mb-1">Couldn&apos;t load your data</h2>
        <p className="text-slate-500 text-sm mb-5 max-w-sm">{error}</p>
        <button onClick={reload} className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap h-9 px-3.5 text-sm rounded-md bg-indigo-600 font-medium text-white shadow-xs transition-colors hover:bg-indigo-700 disabled:opacity-50">
          <RefreshCw size={14} /> Try again
        </button>
      </div>
    )
  }
  return children
}

export default function DashboardLayout({ children }) {
  const { status } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') router.replace(`/login?next=${encodeURIComponent(pathname)}`)
  }, [status, router, pathname])

  if (status !== 'authenticated') {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <Spinner size={28} />
      </div>
    )
  }

  return (
    <AppProvider>
      <div className="flex h-screen bg-slate-50 overflow-hidden">
        {/* Desktop sidebar */}
        <div className="hidden lg:flex lg:w-[232px] shrink-0">
          <div className="w-full">
            <Sidebar />
          </div>
        </div>

        {/* Mobile sidebar overlay */}
        {sidebarOpen && (
          <>
            <div className="fixed inset-0 bg-slate-950/40 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />
            <div className="fixed inset-y-0 left-0 w-64 z-40 lg:hidden shadow-xl">
              <Sidebar onClose={() => setSidebarOpen(false)} />
            </div>
          </>
        )}

        {/* Main content */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <TopBar onMenuClick={() => setSidebarOpen(true)} />
          <BillingBanner />
          <main className="flex-1 overflow-y-auto">
            <DataGate>{children}</DataGate>
          </main>
        </div>
      </div>
    </AppProvider>
  )
}
