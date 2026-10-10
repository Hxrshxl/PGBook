import { Check } from 'lucide-react'

const points = [
  'Sign in with a code sent to their phone. No password, nothing to install.',
  'Pay by UPI and tap “I’ve paid”. You confirm it in one click.',
  'Raise complaints with photos and follow them until they are fixed.',
  'Download receipts, read your notices and give move-out notice.',
  'See the deposit settlement and accept or question it.',
]

/** The tenant app section of the landing page, with a phone-sized preview. */
export default function TenantApp() {
  return (
    <section id="tenant-app" className="scroll-mt-16 border-b border-slate-200 bg-slate-50 py-20 sm:py-24">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 sm:px-8 lg:grid-cols-2 lg:gap-16">
        <div>
          <p className="text-sm font-medium text-indigo-700">Included in every plan</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">An app for your tenants, too</h2>
          <p className="mt-4 text-lg text-slate-600">Fewer calls and WhatsApp messages. Tenants see what they owe and handle the routine themselves.</p>
          <ul className="mt-8 space-y-3">
            {points.map(p => (
              <li key={p} className="flex gap-3 text-[15px] text-slate-700">
                <Check size={18} className="mt-0.5 shrink-0 text-indigo-600" />
                {p}
              </li>
            ))}
          </ul>
        </div>

        <div aria-hidden="true" className="pointer-events-none mx-auto w-full max-w-[300px] select-none">
          <div className="rounded-[36px] border border-slate-300 bg-white p-2.5 shadow-[0_12px_32px_-12px_rgb(0_0_0/0.18)]">
            <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-slate-50">
              <div className="border-b border-slate-200 bg-white px-4 pb-3 pt-5">
                <p className="text-[11px] text-slate-500">Sunrise PG · Room A-104</p>
                <p className="text-[15px] font-semibold text-slate-900">Hi Meera</p>
              </div>
              <div className="space-y-3 p-3">
                <div className="rounded-xl border border-slate-200 bg-white p-3.5">
                  <p className="text-[11px] text-slate-500">Due for October</p>
                  <p className="mt-0.5 text-2xl font-semibold tabular-nums text-slate-900">₹12,500</p>
                  <p className="text-[11px] text-slate-500">Rent ₹11,000 · Food ₹1,200 · Electricity ₹300</p>
                  <div className="mt-3 rounded-lg bg-indigo-600 py-2 text-center text-[13px] font-medium text-white">Pay by UPI</div>
                  <div className="mt-1.5 rounded-lg border border-slate-200 py-2 text-center text-[13px] font-medium text-slate-700">I’ve paid</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white">
                  {[['Notice', 'Water supply off Sunday, 10 am to 2 pm'], ['Complaint', 'Geyser not heating · in progress'], ['Receipt', 'September 2026 · ₹12,500']].map(([k, v]) => (
                    <div key={k} className="border-b border-slate-100 px-3.5 py-2.5 last:border-0">
                      <p className="text-[11px] text-slate-500">{k}</p>
                      <p className="truncate text-[12px] text-slate-900">{v}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
