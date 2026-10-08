'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Menu, Bell, LogOut, ChevronDown, Settings } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useAppData } from '@/context/AppContext'

export default function TopBar({ onMenuClick }) {
  const { user, logout } = useAuth()
  const { complaints, pgSettings } = useAppData()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const openComplaints = complaints.filter(c => c.status !== 'resolved').length

  async function handleLogout() {
    await logout()
    window.location.assign('/') // full reload clears all in-memory data
  }

  return (
    <header className="h-16 bg-white border-b border-slate-100 flex items-center justify-between px-5 shrink-0 z-20">
      <div className="flex items-center gap-4">
        <button onClick={onMenuClick} aria-label="Open menu" className="lg:hidden text-slate-500 hover:text-slate-700 p-1">
          <Menu size={20} />
        </button>
        {pgSettings.pgName && (
          <span className="text-slate-400 text-sm hidden sm:block">{pgSettings.pgName}</span>
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
