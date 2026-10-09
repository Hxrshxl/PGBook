'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, IndianRupee, Wrench, DoorOpen, UserRound, ChevronDown } from 'lucide-react'
import { ResidentProvider, useResident } from '@/context/ResidentContext'
import NotificationBell from '@/components/layout/NotificationBell'
import Spinner from '@/components/ui/Spinner'

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
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-bold text-slate-900">Before you start</h2>
        <div className="text-sm text-slate-600 space-y-2 mt-3">
          <p>Your PG uses PGBook to manage rent and complaints. In this app you see <strong>only your own</strong> stay, payments and requests — never other residents.</p>
          <p>Your PG can see what you send here (payments you report, complaints and photos, move-out notice). PGBook stores it for your PG and does not sell or share it.</p>
          <p>You can download all your data from <em>Me</em> at any time. Your PG may have to keep payment records for tax purposes even after you leave.</p>
        </div>
        <button onClick={acceptPrivacy} className="mt-5 w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3 rounded-xl text-sm">I understand, continue</button>
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
      <header className="sticky top-0 z-20 bg-indigo-600 text-white">
        <div className="max-w-md mx-auto px-4 h-14 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            {tenancies.length > 1 ? (
              <div className="relative">
                <select aria-label="Choose stay" value={tenancyId ?? ''} onChange={e => chooseTenancy(e.target.value)}
                  className="appearance-none bg-transparent font-semibold text-sm pr-6 max-w-full truncate focus:outline-none">
                  {tenancies.map(t => <option key={t.id} value={t.id} className="text-slate-900">{t.pgName} · {t.room}{t.status !== 'active' ? ' (past)' : ''}</option>)}
                </select>
                <ChevronDown size={14} className="absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            ) : (
              <p className="font-semibold text-sm truncate">{stay?.pgName}</p>
            )}
            <p className="text-xs text-indigo-100 truncate">Room {stay?.room} · {stay?.name}</p>
          </div>
          <NotificationBell basePath="/resident" dark align="right" />
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 pt-4 pb-24">{tenancyId ? children : null}</main>

      <nav className="fixed bottom-0 inset-x-0 z-20 bg-white border-t border-slate-200 pb-[env(safe-area-inset-bottom)]">
        <div className="max-w-md mx-auto grid grid-cols-5">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`)
            return (
              <Link key={href} href={href} className={`flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium ${active ? 'text-indigo-600' : 'text-slate-400'}`}>
                <Icon size={20} />{label}
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
