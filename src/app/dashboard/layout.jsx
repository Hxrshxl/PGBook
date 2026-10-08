'use client'
import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { AlertCircle, RefreshCw } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { AppProvider, useAppData } from '@/context/AppContext'
import Sidebar from '@/components/layout/Sidebar'
import TopBar from '@/components/layout/TopBar'
import Spinner from '@/components/ui/Spinner'

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
  if (loading) return <FullScreenSpinner />
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-24 px-6">
        <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center mb-4">
          <AlertCircle size={22} className="text-red-500" />
        </div>
        <h2 className="text-slate-900 font-semibold mb-1">Couldn&apos;t load your data</h2>
        <p className="text-slate-500 text-sm mb-5 max-w-sm">{error}</p>
        <button onClick={reload} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm px-5 py-2.5 rounded-xl transition-colors">
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
        <div className="hidden lg:flex lg:w-60 shrink-0">
          <div className="w-full">
            <Sidebar />
          </div>
        </div>

        {/* Mobile sidebar overlay */}
        {sidebarOpen && (
          <>
            <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />
            <div className="fixed inset-y-0 left-0 w-64 z-40 lg:hidden">
              <Sidebar onClose={() => setSidebarOpen(false)} />
            </div>
          </>
        )}

        {/* Main content */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <TopBar onMenuClick={() => setSidebarOpen(true)} />
          <main className="flex-1 overflow-y-auto">
            <DataGate>{children}</DataGate>
          </main>
        </div>
      </div>
    </AppProvider>
  )
}
