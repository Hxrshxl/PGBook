import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import Badge from '@/components/ui/Badge'
import { LogoMark } from '@/components/ui/Logo'
import { button } from '@/components/ui/styles'

const NAV = ['Overview', 'Approvals', 'Tenants', 'Rooms', 'Complaints', 'Rent', 'Utility bills', 'Expenses', 'Deposits', 'Receipts']
const STATS = [
  ['Collected', '₹3,84,500', '31 of 38 paid'],
  ['Outstanding', '₹71,000', '₹9,000 cash to confirm'],
  ['Occupancy', '92%', '38 of 41 beds'],
  ['Net this month', '₹1,62,300', 'after expenses'],
]
const ROWS = [
  ['Ananya Rao', 'A-101', '₹12,500', '₹12,500', 'paid'],
  ['Rohit Kulkarni', 'A-102', '₹11,000', '₹6,000', 'partial'],
  ['Meera Iyer', 'A-104', '₹12,500', '₹12,500', 'paid'],
  ['Karan Mehta', 'B-201', '₹10,500', '₹0', 'pending'],
  ['Sneha Pillai', 'B-203', '₹11,000', '₹11,000', 'paid'],
]

/** A static, scaled-down rendering of the real Rent screen. */
function ProductPreview() {
  return (
    <div aria-hidden="true" className="pointer-events-none select-none overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgb(0_0_0/0.04),0_12px_32px_-12px_rgb(0_0_0/0.12)]">
      <div className="flex">
        <div className="hidden w-48 shrink-0 border-r border-slate-200 bg-slate-50/60 p-3 md:block">
          <div className="mb-4 flex items-center gap-2 px-2 pt-1"><LogoMark size={20} className="text-slate-900" /><span className="text-[13px] font-semibold text-slate-900">PGBook</span></div>
          {NAV.map(n => (
            <div key={n} className={`rounded-md px-2 py-1.5 text-[12px] ${n === 'Rent' ? 'bg-white font-medium text-slate-900 ring-1 ring-slate-200' : 'text-slate-500'}`}>{n}</div>
          ))}
        </div>
        <div className="min-w-0 flex-1 p-4 sm:p-6">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <p className="text-[15px] font-semibold text-slate-900">Rent</p>
              <p className="text-[12px] text-slate-500">Who has paid for October, and who still owes.</p>
            </div>
            <div className="hidden rounded-md border border-slate-200 px-2.5 py-1 text-[12px] text-slate-700 sm:block">October 2026</div>
          </div>
          <div className="mb-4 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-slate-200 bg-slate-200 lg:grid-cols-4">
            {STATS.map(([label, value, sub]) => (
              <div key={label} className="bg-white px-3 py-2.5">
                <p className="text-[11px] text-slate-500">{label}</p>
                <p className="text-[15px] font-semibold tabular-nums text-slate-900">{value}</p>
                <p className="truncate text-[10px] text-slate-500">{sub}</p>
              </div>
            ))}
          </div>
          <div className="overflow-hidden rounded-lg border border-slate-200">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-slate-200 text-left text-[11px] text-slate-500">
                  <th className="py-2 pl-3 pr-2 font-medium">Tenant</th>
                  <th className="px-2 py-2 text-right font-medium">Total</th>
                  <th className="hidden px-2 py-2 text-right font-medium sm:table-cell">Paid</th>
                  <th className="px-2 py-2 pr-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ROWS.map(([name, room, total, paid, status]) => (
                  <tr key={name}>
                    <td className="py-2 pl-3 pr-2"><p className="font-medium text-slate-900">{name}</p><p className="text-[11px] text-slate-500">{room}</p></td>
                    <td className="px-2 py-2 text-right tabular-nums text-slate-900">{total}</td>
                    <td className="hidden px-2 py-2 text-right tabular-nums text-slate-600 sm:table-cell">{paid}</td>
                    <td className="px-2 py-2 pr-3"><Badge status={status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Hero() {
  return (
    <section className="border-b border-slate-200 bg-white">
      <div className="mx-auto max-w-6xl px-5 pb-16 pt-16 sm:px-8 sm:pt-24">
        <div className="max-w-3xl">
          <p className="mb-5 text-sm font-medium text-indigo-700">For PG and hostel owners in India</p>
          <h1 className="text-4xl font-semibold leading-[1.1] tracking-tight text-slate-900 sm:text-5xl lg:text-[56px]">
            Rent, tenants and bills for your PG, in one place.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-slate-600">
            Know who has paid and who hasn&apos;t, split the electricity bill in a minute, send WhatsApp reminders and receipts,
            and give your tenants an app to pay and raise complaints. Replace the register, the spreadsheet and the WhatsApp group.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/signup" className={button('primary', 'lg')}>Start 14-day free trial <ArrowRight size={16} /></Link>
            <a href="#features" className={button('secondary', 'lg')}>See what it does</a>
          </div>
          <p className="mt-4 text-sm text-slate-500">No card needed. Prices include GST. Export all your data any time.</p>
        </div>

        <div className="mt-14 sm:mt-16">
          <ProductPreview />
        </div>
      </div>
    </section>
  )
}
