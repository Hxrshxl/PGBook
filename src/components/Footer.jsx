import Link from 'next/link'
import { Building2, Mail } from 'lucide-react'

const CONTACT_EMAIL = 'hello@pgbook.in'

// Only links that actually lead somewhere. Add Privacy / Terms pages here
// once their content is ready (they are required before taking payments).
const links = {
  Product: [
    { label: 'Features', href: '/#features' },
    { label: 'How it works', href: '/#how-it-works' },
    { label: 'Pricing', href: '/#pricing' },
    { label: 'FAQ', href: '/#faq' },
  ],
  Account: [
    { label: 'Sign in', href: '/login' },
    { label: 'Start free trial', href: '/signup' },
  ],
  Support: [
    { label: 'Contact us', href: `mailto:${CONTACT_EMAIL}` },
  ],
}

export default function Footer() {
  return (
    <footer className="bg-[#0a0e1a] border-t border-white/5">
      <div className="max-w-6xl mx-auto px-5 sm:px-8 py-16">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-8 mb-12">
          <div className="col-span-2">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
                <Building2 size={16} className="text-white" />
              </div>
              <span className="text-white font-bold text-xl tracking-tight" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                PG<span className="text-indigo-400">Book</span>
              </span>
            </div>
            <p className="text-slate-500 text-sm leading-relaxed mb-5 max-w-xs">
              The operating system for PG owners. Tenant management, rent collection, and utility billing — simplified.
            </p>
            <a href={`mailto:${CONTACT_EMAIL}`} aria-label="Email us" className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors">
              <Mail size={14} />
            </a>
          </div>

          {Object.entries(links).map(([category, items]) => (
            <div key={category}>
              <p className="text-white font-semibold text-sm mb-4">{category}</p>
              <ul className="space-y-2.5">
                {items.map(item => (
                  <li key={item.label}>
                    {item.href.startsWith('/') && !item.href.includes('#') ? (
                      <Link href={item.href} className="text-slate-500 hover:text-slate-300 text-sm transition-colors">{item.label}</Link>
                    ) : (
                      <a href={item.href} className="text-slate-500 hover:text-slate-300 text-sm transition-colors">{item.label}</a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-white/5 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* The page is pre-rendered at build time, so the year may differ from the visitor's clock. */}
          <p className="text-slate-500 text-sm" suppressHydrationWarning>
            © {new Date().getFullYear()} PGBook Technologies Pvt Ltd · Made in India
          </p>
          <p className="text-slate-600 text-xs">
            Built for PG owners in Pune · Bangalore · Hyderabad · Mumbai
          </p>
        </div>
      </div>
    </footer>
  )
}
