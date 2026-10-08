'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Menu, Bell, LogOut, ChevronDown, Settings, Building } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useAppData } from '@/context/AppContext'

export default function TopBar({ onMenuClick }) {
  const { user, access, logout } = useAuth()
  const { complaints, properties, selectedPropertyId, selectProperty } = useAppData()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const openComplaints = complaints.filter(c => c.status !== 'resolved').length

  async function handleLogout() {
    await logout()
    window.location.assign('/') // full reload clears all in-memory data
  }

  return (
    <header className="h-16 bg-white border-b border-slate-100 flex items-center justify-between gap-3 px-5 shrink-0 z-20">
      <div className="flex items-center gap-3 min-w-0">
        <button onClick={onMenuClick} aria-label="Open menu" className="lg:hidden text-slate-500 hover:text-slate-700 p-1">
          <Menu size={20} />
        </button>
        {properties.length > 1 ? (
          <div className="relative min-w-0">
            <Building size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <select
              aria-label="Property"
              value={selectedPropertyId}
              onChange={e => selectProperty(e.target.value)}
              className="max-w-[60vw] sm:max-w-xs appearance-none border border-slate-200 rounded-lg pl-8 pr-8 py-1.5 text-sm font-medium text-slate-800 bg-white hover:border-slate-300 focus:outline-none focus:border-indigo-500 truncate"
            >
              <option value="all">All properties ({properties.length})</option>
              {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        ) : properties[0] && (
          <span className="text-slate-500 text-sm font-medium hidden sm:block truncate">{properties[0].name}</span>
        )}
        {access && access.role !== 'owner' && (
          <span className="hidden sm:inline text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 shrink-0">{access.roleLabel}</span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Link
          href="/dashboard/complaints"
          aria-label={openComplaints ? `${openComplaints} open complaints` : 'Complaints'}
          title={openComplaints ? `${openComplaints} open complaint(s)` : 'No open complaints'}
          className="relative w-9 h-9 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700 transition-colors"
        >
          <Bell size={18} />
          {openComplaints > 0 && (
            <span className="absolute top-1 right-1 min-w-4 h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold leading-4 text-center">
              {openComplaints > 9 ? '9+' : openComplaints}
            </span>
          )}
        </Link>

        <div className="relative">
          <button
            onClick={() => setDropdownOpen(v => !v)}
            aria-expanded={dropdownOpen}
            className="flex items-center gap-2 hover:bg-slate-100 rounded-lg px-2 py-1.5 transition-colors"
          >
            <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold">
              {user?.name?.[0]?.toUpperCase() ?? 'U'}
            </div>
            <span className="text-slate-700 text-sm font-medium hidden sm:block max-w-30 truncate">{user?.name}</span>
            <ChevronDown size={14} className="text-slate-400 hidden sm:block" />
          </button>

          {dropdownOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setDropdownOpen(false)} />
              <div className="absolute right-0 top-full mt-1.5 w-52 bg-white border border-slate-200 rounded-xl shadow-lg z-20 overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100">
                  <p className="text-slate-900 text-sm font-semibold truncate">{user?.name}</p>
                  <p className="text-slate-400 text-xs truncate">{user?.email}</p>
                </div>
                <Link href="/dashboard/settings" onClick={() => setDropdownOpen(false)} className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors">
                  <Settings size={14} />
                  Settings
                </Link>
                <button onClick={handleLogout} className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors">
                  <LogOut size={14} />
                  Sign out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
