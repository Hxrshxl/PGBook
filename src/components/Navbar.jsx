'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Menu, X, Building2 } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'

const links = [
  { label: 'Features',     href: '#features'     },
  { label: 'How it works', href: '#how-it-works' },
  { label: 'Pricing',      href: '#pricing'      },
  { label: 'FAQ',          href: '#faq'          },
]

export default function Navbar() {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const { user } = useAuth()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-[#0a0e1a]/95 backdrop-blur-xl border-b border-white/5 shadow-2xl' : 'bg-transparent'}`}>
      <div className="max-w-6xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center group-hover:bg-indigo-500 transition-colors">
            <Building2 size={16} className="text-white" />
          </div>
          <span style={{ fontFamily: 'Space Grotesk, sans-serif' }} className="text-white font-bold text-xl tracking-tight">
            PG<span className="text-indigo-400">Book</span>
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-8">
          {links.map(l => (
            <a key={l.label} href={l.href} className="text-slate-400 hover:text-white text-sm font-medium transition-colors">{l.label}</a>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-3">
          {user ? (
            <Link href="/dashboard" className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
              Go to Dashboard →
            </Link>
          ) : (
            <>
              <Link href="/login" className="text-slate-400 hover:text-white text-sm font-medium transition-colors">Sign in</Link>
              <Link href="/signup" className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">Start free trial</Link>
            </>
          )}
        </div>

        <button onClick={() => setOpen(!open)} className="md:hidden text-slate-400 hover:text-white">
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {open && (
        <div className="md:hidden nav-mobile border-t border-white/5 px-5 py-4 space-y-3">
          {links.map(l => (
            <a key={l.label} href={l.href} onClick={() => setOpen(false)} className="block text-slate-300 hover:text-white text-sm font-medium py-2">{l.label}</a>
          ))}
          {user ? (
            <Link href="/dashboard" onClick={() => setOpen(false)} className="block w-full text-center bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors mt-2">
              Go to Dashboard →
            </Link>
          ) : (
            <Link href="/signup" onClick={() => setOpen(false)} className="block w-full text-center bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors mt-2">
              Start free trial
            </Link>
          )}
        </div>
      )}
    </nav>
  )
}
