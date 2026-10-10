'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, IndianRupee, Wrench, DoorOpen, UserRound, ChevronDown } from 'lucide-react'
import { ResidentProvider, useResident } from '@/context/ResidentContext'
import NotificationBell from '@/components/layout/NotificationBell'
import Spinner from '@/components/ui/Spinner'
import { LogoMark } from '@/components/ui/Logo'
import { button } from '@/components/ui/styles'

const NAV = [
  { href: '/t/home', label: 'Home', icon: Home },
  { href: '/t/pay', label: 'Pay', icon: IndianRupee },
  { href: '/t/complaints', label: 'Complaints', icon: Wrench },
  { href: '/t/requests', label: 'Move-out', icon: DoorOpen },
  { href: '/t/me', label: 'Me', icon: UserRound },
]

function PrivacyNotice() {
  const { acceptPrivacy } = useResident()
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-4 sm:items-center">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-slate-900">Before you start</h2>
        <div className="text-sm text-slate-600 space-y-2 mt-3">
          <p>Your PG uses PGBook to manage rent and complaints. In this app you see <strong>only your own</strong> stay, payments and requests — never other residents.</p>
          <p>Your PG can see what you send here (payments you report, complaints and photos, move-out notice). PGBook stores it for your PG and does not sell or share it.</p>
          <p>You can download all your data from <em>Me</em> at any time. Your PG may have to keep payment records for tax purposes even after you leave.</p>
        </div>
        <button onClick={acceptPrivacy} className={`${button('primary', 'lg')} mt-5 h-11 w-full`}>I understand, continue</button>
      </div>
    </div>
  )
}

function Shell({ children }) {
  const pathname = usePathname()
  const { resident, tenancies, tenancyId, stay, chooseTenancy, status, error } = useResident()

  if (status === 'loading') return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Spinner size={28} /></div>
  if (status === 'error') return <div className="min-h-screen flex items-center justify-center bg-slate-50 px-6 text-center text-sm text-red-600">{error}</div>
  if (!tenancies.length) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50 px-6 text-center text-sm text-slate-600">No PG stay is linked to your number any more. Please contact your PG.</div>
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-md items-center gap-3 px-4">
          <LogoMark size={26} className="shrink-0 text-slate-900" />
          <div className="min-w-0 flex-1">
            {tenancies.length > 1 ? (
              <div className="relative">
                <select aria-label="Choose stay" value={tenancyId ?? ''} onChange={e => chooseTenancy(e.target.value)}
                  className="max-w-full appearance-none truncate bg-transparent pr-6 text-sm font-semibold text-slate-900 focus:outline-none">
                  {tenancies.map(t => <option key={t.id} value={t.id} className="text-slate-900">{t.pgName} · {t.room}{t.status !== 'active' ? ' (past)' : ''}</option>)}
                </select>
                <ChevronDown size={14} className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-slate-500" />
              </div>
            ) : (
              <p className="truncate text-sm font-semibold text-slate-900">{stay?.pgName}</p>
            )}
            <p className="truncate text-xs text-slate-500">Room {stay?.room} · {stay?.name}</p>
          </div>
          <NotificationBell basePath="/resident" align="right" />
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 pt-4 pb-24">{tenancyId ? children : null}</main>

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <div className="max-w-md mx-auto grid grid-cols-5">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`)
            return (
              <Link key={href} href={href} aria-current={active ? 'page' : undefined} className={`flex flex-col items-center gap-1 py-2 text-[11px] font-medium transition-colors ${active ? 'text-slate-900' : 'text-slate-500 hover:text-slate-800'}`}>
                <Icon size={20} strokeWidth={active ? 2.25 : 1.75} className={active ? 'text-indigo-600' : ''} />{label}
              </Link>
            )
          })}
        </div>
      </nav>
      {resident && !resident.consentAt && <PrivacyNotice />}
    </div>
  )
}

export default function TenantAppLayout({ children }) {
  return (
    <ResidentProvider>
      <Shell>{children}</Shell>
    </ResidentProvider>
  )
}
