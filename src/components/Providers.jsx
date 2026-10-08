'use client'
import ErrorBoundary from './ErrorBoundary'
import { AuthProvider } from '@/context/AuthContext'
import { ToastProvider } from '@/context/ToastContext'

// App data (tenants, payments…) is provided by the dashboard layout only,
// so the public pages never fetch it.
export default function Providers({ children }) {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ToastProvider>
          {children}
        </ToastProvider>
      </AuthProvider>
    </ErrorBoundary>
  )
}
