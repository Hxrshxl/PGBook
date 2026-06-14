'use client'
import { UserPlus, Home, IndianRupee, Send } from 'lucide-react'
import { motion } from 'framer-motion'
import { fadeUp, staggerContainer, scaleIn } from '../utils/animations'

const steps = [
  {
    step: '01', icon: Home,
    title: 'Set up your PG',
    desc: 'Add your PG name, number of rooms, and monthly rent per room. Takes 3 minutes. No technical knowledge needed.',
    detail: 'Configure room types, set default rent amounts, add your bank UPI ID.',
  },
  {
    step: '02', icon: UserPlus,
    title: 'Add your tenants',
    desc: 'Import tenant details — name, room number, move-in date, and contact. Or let tenants self-register via a link you share.',
    detail: 'Tenants get instant access to their personal portal to view dues and raise requests.',
  },
  {
    step: '03', icon: IndianRupee,
    title: 'Track rent & bills',
    desc: "Every month PGBook auto-generates dues. Mark payments as received, split utility bills, and see who's pending at a glance.",
    detail: 'Utility bills split automatically. Partial payments tracked. Arrears carried forward.',
  },
  {
    step: '04', icon: Send,
    title: 'Send receipts & reminders',
    desc: 'One click generates PDF receipts for paid tenants. WhatsApp reminder drafts go out for defaulters before you even think of it.',
    detail: 'Receipts branded with your PG name. Reminders in English or Hindi — you choose.',
  },
]

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24 bg-slate-50 section-border">
      <div className="max-w-6xl mx-auto px-5 sm:px-8">
        <motion.div
          className="text-center mb-16"
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
        >
          <span className="text-indigo-600 text-sm font-semibold uppercase tracking-widest">How it works</span>
          <h2 className="text-4xl sm:text-5xl font-bold text-slate-900 mt-3 mb-4">
            Up and running in 10 minutes
          </h2>
          <p className="text-slate-500 text-lg max-w-xl mx-auto">
            No onboarding calls. No complicated setup. Just sign up and go.
          </p>
        </motion.div>

        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 relative"
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.1 }}
        >
          {/* Connector line (desktop) */}
          <div className="hidden lg:block absolute top-8 left-[12.5%] right-[12.5%] h-px bg-linear-to-r from-indigo-200 via-indigo-400 to-indigo-200" />

          {steps.map(({ step, icon: Icon, title, desc, detail }) => (
            <motion.div key={step} variants={scaleIn} className="relative">
              <div className="flex flex-col items-center mb-6">
                <div className="relative">
                  <div className="w-16 h-16 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-600/25 pulse-ring">
                    <Icon size={24} className="text-white" />
                  </div>
                  <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-white border-2 border-indigo-600 text-indigo-600 text-xs font-bold flex items-center justify-center">
                    {step.replace('0', '')}
                  </span>
                </div>
              </div>
              <div className="text-center">
                <h3 className="font-bold text-slate-900 text-lg mb-2">{title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed mb-3">{desc}</p>
                <p className="text-indigo-500 text-xs leading-relaxed">{detail}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
