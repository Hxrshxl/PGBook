const steps = [
  { title: 'Add your PG', desc: 'Your PG name, rooms and beds, the rent due day and your UPI ID. About five minutes.' },
  { title: 'Add your tenants', desc: 'Name, phone, room, rent and deposit. Invite them to the tenant app if you like.' },
  { title: 'Run the month', desc: 'Create the month’s dues in one click, then record payments, split bills, and send reminders and receipts.' },
]

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-16 border-b border-slate-200 bg-white py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <h2 className="max-w-2xl text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">Set up in an evening</h2>
        <p className="mt-4 max-w-2xl text-lg text-slate-600">No onboarding calls and no training. If you can use WhatsApp, you can use PGBook.</p>
        <ol className="mt-12 grid gap-10 sm:grid-cols-3 sm:gap-8">
          {steps.map((s, i) => (
            <li key={s.title} className="border-t border-slate-900 pt-5">
              <p className="text-sm font-medium tabular-nums text-slate-500">Step {i + 1}</p>
              <h3 className="mt-2 text-lg font-semibold text-slate-900">{s.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-slate-600">{s.desc}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
