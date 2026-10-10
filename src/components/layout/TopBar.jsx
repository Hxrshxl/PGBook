'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Menu, LogOut, ChevronsUpDown, Settings } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useAppData } from '@/context/AppContext'
import { initials } from '@/utils/helpers'
import NotificationBell from './NotificationBell'

export default function TopBar({ onMenuClick }) {
  const { user, access, logout } = useAuth()
  const { properties, selectedPropertyId, selectProperty } = useAppData()
  const [menuOpen, setMenuOpen] = useState(false)

  async function handleLogout() {
    await logout()
    window.location.assign('/') // full reload clears all in-memory data
  }

  return (
    <header className="z-20 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 sm:px-6">
      <div className="flex min-w-0 items-center gap-2">
        <button onClick={onMenuClick} aria-label="Open menu" className="lg:hidden -ml-1.5 inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100">
          <Menu size={18} />
        </button>
        {properties.length > 1 ? (
          <div className="relative min-w-0">
            <select
              aria-label="Property"
              value={selectedPropertyId}
              onChange={e => selectProperty(e.target.value)}
              className="h-8 max-w-[60vw] sm:max-w-xs appearance-none truncate rounded-md border border-slate-200 bg-white pl-2.5 pr-8 text-[13px] font-medium text-slate-900 shadow-xs hover:bg-slate-50 focus:outline-none focus:border-indigo-500"
            >
              <option value="all">All properties</option>
              {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <ChevronsUpDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          </div>
        ) : properties[0] && (
          <span className="hidden sm:block truncate text-[13px] font-medium text-slate-900">{properties[0].name}</span>
        )}
        {access && access.role !== 'owner' && (
          <span className="hidden sm:inline-flex shrink-0 items-center rounded-md bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-600">{access.roleLabel}</span>
        )}
      </div>

      <div className="flex items-center gap-1">
        <NotificationBell />
        <div className="relative">
          <button
            onClick={() => setMenuOpen(v => !v)}
            aria-expanded={menuOpen}
            aria-label="Account menu"
            className="ml-1 flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-xs font-medium text-slate-700 hover:ring-2 hover:ring-slate-200 transition-shadow"
          >
            {initials(user?.name)}
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-full z-20 mt-2 w-56 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                <div className="px-3 py-2">
                  <p className="truncate text-sm font-medium text-slate-900">{user?.name}</p>
                  <p className="truncate text-xs text-slate-500">{user?.email}</p>
                </div>
                <div className="my-1 h-px bg-slate-100" />
                <Link href="/dashboard/settings" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
                  <Settings size={14} className="text-slate-400" /> Settings
                </Link>
                <button onClick={handleLogout} className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
                  <LogOut size={14} className="text-slate-400" /> Sign out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
