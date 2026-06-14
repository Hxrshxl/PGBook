'use client'
import { useState } from 'react'
import { Plus, Minus } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { fadeUp, staggerContainer } from '../utils/animations'

const faqs = [
  { q: 'Do my tenants need to download an app?',     a: 'No. The tenant portal is a web app — they just click the link you share and access it from any browser on their phone. No Play Store, no App Store, no friction.' },
  { q: 'How does the WhatsApp reminder work?',       a: "PGBook generates a personalized message draft for each defaulting tenant. You review it, then tap 'Send' on WhatsApp — the message opens pre-filled. We don't send messages on your behalf, so you stay in control." },
  { q: 'Can I use it for food + accommodation PGs?', a: 'Yes. You can add a separate monthly food charge per tenant, track it alongside rent, and include it in the PDF receipt. Utility bill splitting works separately on top.' },
  { q: 'What happens to my data if I cancel?',       a: "You own your data. On cancellation, we give you a full export (CSV + PDFs) of all tenant records, payment history, and receipts. Nothing is deleted for 90 days after cancellation." },
  { q: 'Is this legal? Can the receipts be used for tax purposes?', a: 'Yes. Receipts include your PG name, address, tenant details, period, and amounts. They are GST-ready (you can add your GSTIN). Many tenants use these for HRA claims at their companies.' },
  { q: 'I manage 2 PGs in different buildings. How does that work?', a: 'The Pro plan covers one PG. The Multi-PG plan (₹999/month) covers up to 5 properties from a single account with consolidated monthly reports across all locations.' },
  { q: 'How does utility bill splitting work exactly?', a: 'You enter the total electricity or water bill for the month. PGBook divides it equally (or by occupancy, if rooms have different capacities). Each tenant sees their share added to their monthly dues.' },
  { q: 'Can I try it before paying?',                a: "Yes — 14-day free trial, no credit card required. You'll have full access to all Pro features. We'll remind you before the trial ends." },
]

function FAQItem({ q, a }) {
  const [open, setOpen] = useState(false)

  return (
    <div
      className="border border-slate-200 rounded-xl overflow-hidden cursor-pointer hover:border-indigo-200 transition-colors"
      onClick={() => setOpen(!open)}
    >
      <div className="flex items-center justify-between gap-4 p-5">
        <p className="text-slate-900 font-semibold text-sm sm:text-base flex-1">{q}</p>
        <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-colors ${open ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
          {open ? <Minus size={14} /> : <Plus size={14} />}
        </div>
      </div>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 border-t border-slate-100">
              <p className="text-slate-500 text-sm leading-relaxed pt-4">{a}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function FAQ() {
  return (
    <section id="faq" className="py-24 bg-slate-50 section-border">
      <div className="max-w-3xl mx-auto px-5 sm:px-8">
        <motion.div
          className="text-center mb-12"
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
        >
          <span className="text-indigo-600 text-sm font-semibold uppercase tracking-widest">FAQ</span>
          <h2 className="text-4xl sm:text-5xl font-bold text-slate-900 mt-3 mb-4">Honest answers</h2>
          <p className="text-slate-500 text-lg max-w-lg mx-auto">
            If you have a question that's not here, email us at hello@pgbook.in
          </p>
        </motion.div>

        <motion.div
          className="space-y-3"
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.1 }}
        >
          {faqs.map((f) => (
            <motion.div key={f.q} variants={fadeUp}>
              <FAQItem q={f.q} a={f.a} />
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
