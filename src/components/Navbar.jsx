'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Menu, X } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import Logo from '@/components/ui/Logo'
import { button } from '@/components/ui/styles'

const links = [
  { label: 'Features',     href: '#features'     },
  { label: 'Tenant app',   href: '#tenant-app'   },
  { label: 'Pricing',      href: '#pricing'      },
  { label: 'FAQ',          href: '#faq'          },
]

export default function Navbar() {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const { user } = useAuth()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header className={`sticky top-0 z-50 border-b bg-white/90 backdrop-blur transition-colors ${scrolled || open ? 'border-slate-200' : 'border-transparent'}`}>
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
        <Link href="/" aria-label="PGBook home"><Logo /></Link>

        <div className="hidden items-center gap-7 md:flex">
          {links.map(l => (
            <a key={l.label} href={l.href} className="text-sm text-slate-600 transition-colors hover:text-slate-900">{l.label}</a>
          ))}
        </div>

        <div className="hidden items-center gap-2 md:flex">
          {user ? (
            <Link href="/dashboard" className={button('primary')}>Open dashboard</Link>
          ) : (
            <>
              <Link href="/t" className={button('ghost')}>Tenant login</Link>
              <Link href="/login" className={button('ghost')}>Sign in</Link>
              <Link href="/signup" className={button('primary')}>Start free trial</Link>
            </>
          )}
        </div>

        <button onClick={() => setOpen(!open)} aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} className="-mr-2 rounded-md p-2 text-slate-600 hover:bg-slate-100 md:hidden">
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </nav>

      {open && (
        <div className="border-t border-slate-200 bg-white px-5 pb-5 pt-2 md:hidden">
          {links.map(l => (
            <a key={l.label} href={l.href} onClick={() => setOpen(false)} className="block py-2.5 text-sm text-slate-700">{l.label}</a>
          ))}
          <div className="mt-3 grid gap-2">
            {user ? (
              <Link href="/dashboard" onClick={() => setOpen(false)} className={button('primary', 'lg')}>Open dashboard</Link>
            ) : (
              <>
                <Link href="/signup" onClick={() => setOpen(false)} className={button('primary', 'lg')}>Start free trial</Link>
                <Link href="/login" onClick={() => setOpen(false)} className={button('secondary', 'lg')}>Sign in</Link>
                <Link href="/t" onClick={() => setOpen(false)} className={button('ghost', 'lg')}>Tenant login</Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  )
}
