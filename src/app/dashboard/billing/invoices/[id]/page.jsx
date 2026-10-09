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
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between gap-3 mb-6">
        <Link href="/dashboard/billing" className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800"><ArrowLeft size={15} /> Subscription</Link>
        {invoice && (
          <button onClick={() => printHtml(ref.current.innerHTML, invoice.number)} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm px-4 py-2 rounded-xl">
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
