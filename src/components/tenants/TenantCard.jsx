'use client'
import Link from 'next/link'
import { Pencil, LogOut, History, Phone, RotateCcw, Trash2 } from 'lucide-react'
import Badge from '@/components/ui/Badge'
import { formatCurrency, formatDate } from '@/utils/helpers'

export default function TenantCard({ tenant, onEdit, onVacate, onReactivate, onDelete }) {
  const { name, room, rentAmount, depositAmount, status, moveInDate, moveOutDate, phone } = tenant
  const btn = 'flex-1 flex items-center justify-center gap-1.5 text-xs text-slate-500 py-1.5 rounded-lg transition-colors'

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-base font-bold shrink-0">
            {name[0]?.toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-slate-900 font-semibold text-sm truncate">{name}</p>
            <p className="text-slate-400 text-xs mt-0.5">Room {room}</p>
          </div>
        </div>
        <Badge status={status} />
      </div>

      <div className="space-y-1.5 text-xs text-slate-500 mb-4">
        <div className="flex items-center justify-between">
          <span>Monthly rent</span>
          <span className="font-semibold text-slate-900 text-sm">{formatCurrency(rentAmount)}</span>
        </div>
        {depositAmount > 0 && (
          <div className="flex items-center justify-between">
            <span>Deposit</span>
            <span className="text-slate-700">{formatCurrency(depositAmount)}</span>
          </div>
        )}
        <div className="flex items-center justify-between">
          <span>{status === 'vacated' ? 'Stayed' : 'Moved in'}</span>
          <span className="text-slate-600">
            {formatDate(moveInDate)}{status === 'vacated' && ` → ${formatDate(moveOutDate)}`}
          </span>
        </div>
        <a href={`tel:${phone}`} className="flex items-center gap-1.5 text-slate-500 hover:text-indigo-600 w-fit">
          <Phone size={12} /> {phone}
        </a>
      </div>

      <div className="flex items-center gap-1 pt-3 border-t border-slate-50 mt-auto">
        <Link href={`/dashboard/history?tenantId=${tenant.id}`} className={`${btn} hover:text-indigo-600 hover:bg-indigo-50`}>
          <History size={13} /> History
        </Link>
        <button onClick={() => onEdit(tenant)} className={`${btn} hover:text-blue-600 hover:bg-blue-50`}>
          <Pencil size={13} /> Edit
        </button>
        {status === 'active' ? (
          <button onClick={() => onVacate(tenant)} className={`${btn} hover:text-amber-700 hover:bg-amber-50`}>
            <LogOut size={13} /> Vacate
          </button>
        ) : (
          <>
            <button onClick={() => onReactivate(tenant)} className={`${btn} hover:text-emerald-700 hover:bg-emerald-50`}>
              <RotateCcw size={13} /> Restore
            </button>
            <button onClick={() => onDelete(tenant)} aria-label={`Delete ${name}`} className={`${btn} hover:text-red-600 hover:bg-red-50`}>
              <Trash2 size={13} /> Delete
            </button>
          </>
        )}
      </div>
    </div>
  )
}
