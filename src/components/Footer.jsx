import Link from 'next/link'
import Logo from '@/components/ui/Logo'

const CONTACT_EMAIL = 'hello@pgbook.in'

// Only links that actually lead somewhere. Add Privacy / Terms pages here
// once their content is ready (they are required before taking payments).
const links = {
  Product: [
    { label: 'Features', href: '/#features' },
    { label: 'Tenant app', href: '/#tenant-app' },
    { label: 'Pricing', href: '/#pricing' },
    { label: 'FAQ', href: '/#faq' },
  ],
  Account: [
    { label: 'Sign in', href: '/login' },
    { label: 'Start free trial', href: '/signup' },
    { label: 'Tenant login', href: '/t' },
  ],
  Support: [
    { label: CONTACT_EMAIL, href: `mailto:${CONTACT_EMAIL}` },
  ],
}

export default function Footer() {
  return (
    <footer className="bg-white">
      <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8">
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-5">
          <div className="col-span-2">
            <Logo />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-slate-500">Rent, tenants and bills for PG and hostel owners in India.</p>
          </div>
          {Object.entries(links).map(([category, items]) => (
            <div key={category}>
              <p className="text-sm font-medium text-slate-900">{category}</p>
              <ul className="mt-3 space-y-2">
                {items.map(item => (
                  <li key={item.label}>
                    {item.href.startsWith('/') && !item.href.includes('#')
                      ? <Link href={item.href} className="text-sm text-slate-500 transition-colors hover:text-slate-900">{item.label}</Link>
                      : <a href={item.href} className="text-sm text-slate-500 transition-colors hover:text-slate-900">{item.label}</a>}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-12 border-t border-slate-200 pt-6">
          {/* The page is pre-rendered at build time, so the year may differ from the visitor's clock. */}
          <p className="text-sm text-slate-500" suppressHydrationWarning>© {new Date().getFullYear()} PGBook Technologies Pvt Ltd · Made in India</p>
        </div>
      </div>
    </footer>
  )
}
