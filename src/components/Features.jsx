'use client'
import { Users, IndianRupee, Zap, FileText, Bell, MessageSquare, BarChart3, Shield } from 'lucide-react'
import { motion } from 'framer-motion'
import { fadeUp, staggerContainer } from '../utils/animations'

const features = [
  { icon: Users,         color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',  title: 'Tenant Roster',        desc: 'Digital tenant register with room assignments, move-in dates, ID docs, and emergency contacts. No more handwritten registers.' },
  { icon: IndianRupee,   color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', title: 'Rent Tracker',        desc: 'Monthly rent status at a glance. Mark paid, partial, or pending. See who owes what across all rooms instantly.' },
  { icon: Zap,           color: 'bg-amber-500/10 text-amber-400 border-amber-500/20',     title: 'Utility Bill Splitter', desc: 'Enter the electricity and water bill once. PGBook splits it fairly across all tenants and adds it to their dues automatically.' },
  { icon: FileText,      color: 'bg-blue-500/10 text-blue-400 border-blue-500/20',        title: 'PDF Rent Receipts',    desc: 'Generate professional rent receipts in one click. Branded with your PG name, GST-ready, and downloadable by tenants.' },
  { icon: Bell,          color: 'bg-orange-500/10 text-orange-400 border-orange-500/20',  title: 'Payment Reminders',    desc: 'Automated WhatsApp message drafts sent to defaulters on due date. Personal-sounding, not spammy. You approve before sending.' },
  { icon: MessageSquare, color: 'bg-pink-500/10 text-pink-400 border-pink-500/20',        title: 'Complaint Portal',     desc: 'Tenants raise maintenance issues from their portal. You see them on your dashboard and update status. Transparent, trackable.' },
  { icon: BarChart3,     color: 'bg-purple-500/10 text-purple-400 border-purple-500/20',  title: 'Revenue Analytics',    desc: 'Monthly revenue trends, occupancy rate, payment history, and collection efficiency — all in simple charts, not spreadsheets.' },
  { icon: Shield,        color: 'bg-teal-500/10 text-teal-400 border-teal-500/20',        title: 'Tenant History',       desc: 'Complete payment records, receipts, and communication logs for every tenant. Legally valuable data, fully yours.' },
]

export default function Features() {
  return (
    <section id="features" className="py-24 bg-white">
      <div className="max-w-6xl mx-auto px-5 sm:px-8">
        {/* Section header */}
        <motion.div
          className="text-center mb-16"
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
        >
          <span className="text-indigo-600 text-sm font-semibold uppercase tracking-widest">Features</span>
          <h2 className="text-4xl sm:text-5xl font-bold text-slate-900 mt-3 mb-4">
            Everything a PG owner needs
          </h2>
          <p className="text-slate-500 text-lg max-w-xl mx-auto">
            Replace the notebook, the WhatsApp group, and the Excel sheet — with one tool that does it all.
          </p>
        </motion.div>

        {/* Grid */}
        <motion.div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5"
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.1 }}
        >
          {features.map(({ icon: Icon, color, title, desc }) => (
            <motion.div key={title} variants={fadeUp} className="card-hover bg-white rounded-2xl p-6 cursor-default">
              <div className={`w-10 h-10 rounded-xl border flex items-center justify-center mb-4 ${color}`}>
                <Icon size={18} />
              </div>
              <h3 className="font-semibold text-slate-900 text-base mb-2">{title}</h3>
              <p className="text-slate-500 text-sm leading-relaxed">{desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
