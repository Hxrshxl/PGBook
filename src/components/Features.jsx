import { Users, IndianRupee, Zap, FileText, MessageCircle, Wrench, BarChart3, ShieldCheck, Building2 } from 'lucide-react'

const features = [
  { icon: IndianRupee,   title: 'Rent tracking',        desc: 'Create the month’s dues in one click. Record full or part payments, cash or UPI, and see exactly who owes what.' },
  { icon: Users,         title: 'Tenants and rooms',    desc: 'One register for tenants, rooms and beds: move-in dates, IDs, emergency contacts, and which beds are free.' },
  { icon: Zap,           title: 'Utility bill splitting', desc: 'Enter the electricity or water bill once. Each tenant’s share is added to their dues automatically.' },
  { icon: MessageCircle, title: 'WhatsApp reminders',   desc: 'A ready-to-send reminder in English or Hindi for every tenant who owes, with your UPI ID included.' },
  { icon: FileText,      title: 'Receipts',             desc: 'Print or save a PDF receipt with your PG’s name and address. Tenants can download theirs in the app.' },
  { icon: Wrench,        title: 'Complaints',           desc: 'Tenants report issues with photos. You track each one from open to fixed, and they see the progress.' },
  { icon: BarChart3,     title: 'Expenses and profit',  desc: 'Record salaries, groceries and repairs. See money in, money out and what is left, month by month.' },
  { icon: Building2,     title: 'Several properties',   desc: 'Run more than one PG from one account, with separate rooms, rules and UPI IDs for each.' },
  { icon: ShieldCheck,   title: 'Staff with limits',    desc: 'Give your manager or caretaker their own login. Cash they collect waits for your confirmation.' },
]

export default function Features() {
  return (
    <section id="features" className="scroll-mt-16 border-b border-slate-200 bg-white py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">Everything you do each month, without the paperwork</h2>
          <p className="mt-4 text-lg text-slate-600">Built around how PGs actually run: monthly rent, shared bills, cash at the door and tenants who come and go.</p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="bg-white p-6">
              <Icon size={20} strokeWidth={1.75} className="text-slate-900" />
              <h3 className="mt-4 text-[15px] font-semibold text-slate-900">{title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
