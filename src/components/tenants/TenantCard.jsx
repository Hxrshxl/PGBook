'use client'
import Link from 'next/link'
import { Pencil, Trash2, History } from 'lucide-react'
import Badge from '@/components/ui/Badge'
import { formatCurrency } from '@/utils/helpers'

export default function TenantCard({ tenant, onEdit, onDelete }) {
  const { name, room, rentAmount, status, moveInDate } = tenant
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-base font-bold shrink-0">
            {name[0]?.toUpperCase()}
          </div>
          <div>
            <p className="text-slate-900 font-semibold text-sm">{name}</p>
            <p className="text-slate-400 text-xs mt-0.5">Room {room}</p>
          </div>
        </div>
        <Badge status={status} />
      </div>

      <div className="flex items-center justify-between text-xs text-slate-500 mb-3">
        <span>Monthly rent</span>
        <span className="font-semibold text-slate-900 text-sm">{formatCurrency(rentAmount)}</span>
      </div>

      <p className="text-xs text-slate-400 mb-4">
        Moved in:{' '}
        <span className="text-slate-600">
          {new Date(moveInDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
        </span>
      </p>

      <div className="flex items-center gap-2 pt-3 border-t border-slate-50">
        <Link
          href={`/dashboard/history?tenantId=${tenant.id}`}
          className="flex-1 flex items-center justify-center gap-1.5 text-xs text-slate-500 hover:text-indigo-600 py-1.5 rounded-lg hover:bg-indigo-50 transition-colors"
        >
          <History size={13} /> History
        </Link>
        <button
          onClick={() => onEdit(tenant)}
          className="flex-1 flex items-center justify-center gap-1.5 text-xs text-slate-500 hover:text-blue-600 py-1.5 rounded-lg hover:bg-blue-50 transition-colors"
        >
          <Pencil size={13} /> Edit
        </button>
        {status === 'active' && (
          <button
            onClick={() => onDelete(tenant)}
            className="flex-1 flex items-center justify-center gap-1.5 text-xs text-slate-500 hover:text-red-600 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
          >
            <Trash2 size={13} /> Remove
          </button>
        )}
      </div>
    </div>
  )
}
