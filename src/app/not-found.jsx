'use client'
import Link from 'next/link'
import { Building2, Home } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="hero-bg min-h-screen flex flex-col items-center justify-center text-center px-5">
      <div className="w-16 h-16 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center mb-6">
        <Building2 size={28} className="text-indigo-400" />
      </div>
      <h1 className="text-7xl font-bold text-white mb-2">404</h1>
      <p className="text-2xl font-semibold text-slate-300 mb-3">Room not found</p>
      <p className="text-slate-500 text-base max-w-sm mb-8">
        This page doesn't exist or may have been moved. Let's get you back home.
      </p>
      <Link
        href="/"
        className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-6 py-3 rounded-xl transition-colors"
      >
        <Home size={18} />
        Back to Home
      </Link>
    </div>
  )
}
