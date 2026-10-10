'use client'
import { use, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Printer } from 'lucide-react'
import { api } from '@/utils/api'
import { printHtml } from '@/utils/print'
import InvoiceTemplate from '@/components/billing/InvoiceTemplate'
import FormError from '@/components/ui/FormError'
import Spinner from '@/components/ui/Spinner'

export default function InvoicePage({ params }) {
  const { id } = use(params)
  const [invoice, setInvoice] = useState(null)
  const [error, setError] = useState('')
  const ref = useRef(null)
  useEffect(() => { api.get(`/billing/invoices/${id}`).then(setInvoice).catch(e => setError(e.message)) }, [id])

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between gap-3 mb-6">
        <Link href="/dashboard/billing" className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800"><ArrowLeft size={15} /> Subscription</Link>
        {invoice && (
          <button onClick={() => printHtml(ref.current.innerHTML, invoice.number)} className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap h-9 px-3.5 text-sm rounded-md bg-indigo-600 font-medium text-white shadow-xs transition-colors hover:bg-indigo-700 disabled:opacity-50">
            <Printer size={15} /> Print / Save PDF
          </button>
        )}
      </div>
      {error ? <FormError message={error} /> : !invoice ? <div className="flex justify-center py-20"><Spinner size={26} /></div> : (
        <div ref={ref} className="overflow-x-auto"><InvoiceTemplate invoice={invoice} /></div>
      )}
    </div>
  )
}
