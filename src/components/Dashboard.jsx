'use client'
import { CheckCircle2, Clock, AlertCircle, Wrench } from 'lucide-react'

const tenants = [
  { name: 'Ravi Sharma', room: 'A-101', rent: '₹12,000', status: 'paid', date: 'Jun 1' },
  { name: 'Priya Menon', room: 'B-204', rent: '₹10,500', status: 'paid', date: 'Jun 2' },
  { name: 'Aakash Patel', room: 'A-301', rent: '₹11,000', status: 'pending', date: 'Due Jun 5' },
  { name: 'Sneha Iyer', room: 'C-102', rent: '₹9,500', status: 'partial', date: '₹5,000 paid' },
  { name: 'Vikram Nair', room: 'B-103', rent: '₹10,000', status: 'paid', date: 'Jun 1' },
]

const complaints = [
  { tenant: 'Sneha Iyer', room: 'C-102', issue: 'Water heater not working', status: 'open', time: '2h ago' },
  { tenant: 'Aakash Patel', room: 'A-301', issue: 'WiFi connectivity issues', status: 'in-progress', time: '1d ago' },
  { tenant: 'Ravi Sharma', room: 'A-101', issue: 'Fan making noise', status: 'resolved', time: '3d ago' },
]

const statusConfig = {
  paid: { label: 'Paid', class: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  pending: { label: 'Pending', class: 'bg-amber-50 text-amber-700 border border-amber-200' },
  partial: { label: 'Partial', class: 'bg-blue-50 text-blue-700 border border-blue-200' },
  open: { label: 'Open', class: 'bg-red-50 text-red-700 border border-red-200' },
  'in-progress': { label: 'In Progress', class: 'bg-amber-50 text-amber-700 border border-amber-200' },
  resolved: { label: 'Resolved', class: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
}

export default function Dashboard() {
  return (
    <section className="py-24 bg-white section-border">
      <div className="max-w-6xl mx-auto px-5 sm:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
          {/* Left: copy */}
          <div className="lg:sticky lg:top-24">
            <span className="text-indigo-600 text-sm font-semibold uppercase tracking-widest">Owner dashboard</span>
            <h2 className="text-4xl sm:text-5xl font-bold text-slate-900 mt-3 mb-5">
              Your entire PG, one screen
            </h2>
            <p className="text-slate-500 text-lg leading-relaxed mb-8">
              Every morning, see who paid, who hasn't, what's broken, and what needs your attention today —
              before you even finish your chai.
            </p>

            <div className="space-y-4">
              {[
                { icon: CheckCircle2, color: 'text-emerald-500', title: 'Real-time payment status', desc: 'Payments marked the moment a tenant logs into their portal' },
                { icon: Wrench, color: 'text-indigo-500', title: 'Complaint management', desc: 'Track open, in-progress, and resolved maintenance issues' },
                { icon: Clock, color: 'text-amber-500', title: 'Daily reminders', desc: 'Automated nudges on rent due dates, no manual follow-ups' },
                { icon: AlertCircle, color: 'text-orange-500', title: 'Vacancy alerts', desc: 'Know when a room is about to go empty and start the search early' },
              ].map(({ icon: Icon, color, title, desc }) => (
                <div key={title} className="flex gap-4">
                  <Icon size={20} className={`${color} mt-0.5 flex-shrink-0`} />
                  <div>
                    <p className="font-semibold text-slate-800 text-sm">{title}</p>
                    <p className="text-slate-500 text-sm">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: live dashboard preview */}
          <div className="space-y-4">
            {/* Rent status card */}
            <div className="bg-[#0f1629] rounded-2xl border border-white/8 overflow-hidden">
              <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
                <h3 className="text-white font-semibold text-sm">June 2025 — Rent Status</h3>
                <span className="text-xs text-slate-500">18/20 collected</span>
              </div>
              <div className="divide-y divide-white/5">
                {tenants.map((t) => (
                  <div key={t.name} className="flex items-center justify-between px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-indigo-900 flex items-center justify-center text-indigo-300 text-xs font-bold flex-shrink-0">
                        {t.name[0]}
                      </div>
                      <div>
                        <p className="text-white text-xs font-medium">{t.name}</p>
                        <p className="text-slate-500 text-xs">{t.room}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-white text-xs font-semibold">{t.rent}</span>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusConfig[t.status].class}`}>
                        {statusConfig[t.status].label}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Complaints card */}
            <div className="bg-[#0f1629] rounded-2xl border border-white/8 overflow-hidden">
              <div className="px-5 py-4 border-b border-white/5">
                <h3 className="text-white font-semibold text-sm">Maintenance Complaints</h3>
              </div>
              <div className="divide-y divide-white/5">
                {complaints.map((c) => (
                  <div key={c.issue} className="px-5 py-3 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-white text-xs font-medium">{c.issue}</p>
                      <p className="text-slate-500 text-xs mt-0.5">{c.tenant} · {c.room} · {c.time}</p>
                    </div>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${statusConfig[c.status].class}`}>
                      {statusConfig[c.status].label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
