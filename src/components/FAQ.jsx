import { Plus } from 'lucide-react'

const CONTACT_EMAIL = 'hello@pgbook.in'

const faqs = [
  { q: 'Do my tenants need to download an app?', a: 'No. The tenant app opens in the phone’s browser. Tenants sign in with a code sent to their phone number, so there is no password and nothing to install.' },
  { q: 'How do the WhatsApp reminders work?', a: 'PGBook writes a reminder for each tenant who owes, in English or Hindi, with the amount and your UPI ID. You tap the button and WhatsApp opens with the message ready. Nothing is sent without you.' },
  { q: 'Can I charge for food, laundry or other extras?', a: 'Yes. Add recurring charges such as food to any tenant. They are added to the monthly dues and shown separately on the receipt. Utility bills are split on top.' },
  { q: 'How does utility bill splitting work?', a: 'Enter the month’s electricity or water bill and choose who shares it. PGBook works out each share and adds it to those tenants’ dues.' },
  { q: 'I run more than one PG. Can I manage them together?', a: 'Yes. The Multi-PG plan covers up to five properties from one account. Each property keeps its own rooms, rent rules and UPI ID, and you can view them together or one at a time.' },
  { q: 'Can my staff use it?', a: 'Yes. Give your manager, accountant or caretaker their own login with only the access they need. Cash they collect is counted once you or your accountant confirm it, and everything they do is logged.' },
  { q: 'What happens to my data if I stop paying or cancel?', a: 'Your account becomes read-only: you can still view everything and export it as spreadsheets. Your data is kept for 90 days, and you can subscribe again any time to continue where you left off.' },
  { q: 'Can I try it before paying?', a: 'Yes. You get a 14-day free trial with every feature switched on, and no card is needed to start.' },
]

export default function FAQ() {
  return (
    <section id="faq" className="scroll-mt-16 border-b border-slate-200 bg-white py-20 sm:py-24">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 sm:px-8 lg:grid-cols-[1fr_2fr] lg:gap-16">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">Questions</h2>
          <p className="mt-4 text-slate-600">
            Anything else? Email <a href={`mailto:${CONTACT_EMAIL}`} className="font-medium text-slate-900 underline underline-offset-2">{CONTACT_EMAIL}</a> and a person will reply.
          </p>
        </div>
        <div className="divide-y divide-slate-200 border-y border-slate-200">
          {faqs.map(({ q, a }) => (
            <details key={q} className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-left text-[15px] font-medium text-slate-900 [&::-webkit-details-marker]:hidden">
                {q}
                <Plus size={18} className="shrink-0 text-slate-400 transition-transform group-open:rotate-45" />
              </summary>
              <p className="-mt-1 pb-5 pr-10 text-[15px] leading-relaxed text-slate-600">{a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}
