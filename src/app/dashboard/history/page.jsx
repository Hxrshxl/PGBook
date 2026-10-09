'use client'
import { Suspense } from 'react'
import TenantHistoryPage from '@/views/dashboard/TenantHistoryPage'

// useSearchParams() needs a Suspense boundary.
export default function Page() {
  return (
    <Suspense>
      <TenantHistoryPage />
    </Suspense>
  )
}
