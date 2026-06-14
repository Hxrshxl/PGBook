'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Check, Zap } from 'lucide-react'
import { motion } from 'framer-motion'
import { fadeUp, fadeIn, staggerContainer, scaleIn } from '@/utils/animations'

const ownerFeatures = [
  'Tenant roster (unlimited tenants)',
  'Monthly rent tracker',
  'Utility bill splitter',
  'PDF rent receipt generator',
  'WhatsApp reminder drafts',
  'Complaint management portal',
  'Revenue analytics',
  'Tenant payment history',
  'Mobile-friendly dashboard',
  'Priority email support',
]

const starterFeatures = [
  'Up to 10 tenants',
  'Rent tracker',
  'Utility splitter',
  'Receipt generator',
  'Basic analytics',
]

export default function Pricing() {
  const [annual, setAnnual] = useState(false)

  const proPrice = annual ? 399 : 499
  const savings = annual ? Math.round((499 * 12 - 399 * 12) / 100) * 100 : 0

  return (
    <section id="pricing" className="py-24 bg-slate-50 section-border">
      <div className="max-w-6xl mx-auto px-5 sm:px-8">
        <motion.div
          className="text-center mb-12"
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
        >
          <span className="text-indigo-600 text-sm font-semibold uppercase tracking-widest">Pricing</span>
          <h2 className="text-4xl sm:text-5xl font-bold text-slate-900 mt-3 mb-4">
            Less than a dinner out
          </h2>
          <p className="text-slate-500 text-lg max-w-xl mx-auto mb-8">
            A 20-room PG earns ₹2–3L/month. ₹499 is 0.02% of that.
          </p>

          {/* Toggle */}
          <motion.div variants={fadeIn} className="inline-flex items-center gap-3 bg-white border border-slate-200 rounded-full p-1">
            <button
              onClick={() => setAnnual(false)}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
                !annual ? 'bg-indigo-600 text-white shadow' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setAnnual(true)}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${
                annual ? 'bg-indigo-600 text-white shadow' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Annual
              <span className="bg-emerald-100 text-emerald-700 text-xs px-2 py-0.5 rounded-full font-semibold">
                Save 20%
              </span>
            </button>
          </motion.div>
        </motion.div>

        <motion.div
          className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto"
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.1 }}
        >
          {/* Starter */}
          <motion.div variants={scaleIn} className="bg-white rounded-2xl border border-slate-200 p-7">
            <p className="text-slate-500 text-sm font-semibold uppercase tracking-wider mb-2">Starter</p>
            <div className="flex items-baseline gap-1 mb-1">
              <span className="text-3xl font-bold text-slate-900" style={{ fontFamily: 'Space Grotesk' }}>
                ₹{annual ? 199 : 249}
              </span>
              <span className="text-slate-400 text-sm">/month</span>
            </div>
            <p className="text-slate-400 text-sm mb-6">For small PGs with up to 10 tenants</p>
            <Link
              href="/signup"
              className="block text-center border border-slate-200 hover:border-indigo-400 text-slate-700 hover:text-indigo-600 font-semibold text-sm py-2.5 rounded-xl mb-6 transition-colors"
            >
              Start free trial
            </Link>
            <ul className="space-y-2.5">
              {starterFeatures.map((f) => (
                <li key={f} className="flex items-start gap-2.5">
                  <Check size={15} className="text-emerald-500 mt-0.5 shrink-0" />
                  <span className="text-slate-600 text-sm">{f}</span>
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Pro — highlighted */}
          <motion.div variants={scaleIn} className="relative bg-indigo-950 rounded-2xl p-7 shadow-xl shadow-indigo-900/30">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <span className="bg-orange-500 text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                <Zap size={11} fill="white" /> Most popular
              </span>
            </div>
            <p className="text-indigo-300 text-sm font-semibold uppercase tracking-wider mb-2">Pro</p>
            <div className="flex items-baseline gap-1 mb-1">
              <span className="text-3xl font-bold text-white" style={{ fontFamily: 'Space Grotesk' }}>
                ₹{proPrice}
              </span>
              <span className="text-indigo-400 text-sm">/month</span>
            </div>
            {annual && <p className="text-emerald-400 text-xs mb-1">You save ₹{savings}/year</p>}
            <p className="text-indigo-400 text-sm mb-6">For active PGs with up to 50 tenants</p>
            <Link
              href="/signup"
              className="glow-btn block text-center bg-orange-500 hover:bg-orange-400 text-white font-bold text-sm py-2.5 rounded-xl mb-6 transition-colors"
            >
              Start free trial
            </Link>
            <ul className="space-y-2.5">
              {ownerFeatures.map((f) => (
                <li key={f} className="flex items-start gap-2.5">
                  <Check size={15} className="text-emerald-400 mt-0.5 shrink-0" />
                  <span className="text-indigo-200 text-sm">{f}</span>
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Multi-PG */}
          <motion.div variants={scaleIn} className="bg-white rounded-2xl border border-slate-200 p-7">
            <p className="text-slate-500 text-sm font-semibold uppercase tracking-wider mb-2">Multi-PG</p>
            <div className="flex items-baseline gap-1 mb-1">
              <span className="text-3xl font-bold text-slate-900" style={{ fontFamily: 'Space Grotesk' }}>
                ₹{annual ? 799 : 999}
              </span>
              <span className="text-slate-400 text-sm">/month</span>
            </div>
            <p className="text-slate-400 text-sm mb-6">For owners managing 2–5 PGs from one account</p>
            <Link
              href="/signup"
              className="block text-center border border-slate-200 hover:border-indigo-400 text-slate-700 hover:text-indigo-600 font-semibold text-sm py-2.5 rounded-xl mb-6 transition-colors"
            >
              Contact us
            </Link>
            <ul className="space-y-2.5">
              {['Everything in Pro', 'Up to 5 PG properties', 'Unlimited tenants', 'Consolidated reports', 'Dedicated support', 'Custom branding on receipts'].map((f) => (
                <li key={f} className="flex items-start gap-2.5">
                  <Check size={15} className="text-emerald-500 mt-0.5 shrink-0" />
                  <span className="text-slate-600 text-sm">{f}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        </motion.div>

        <p className="text-center text-slate-400 text-sm mt-8">
          14-day free trial · No credit card required · Cancel anytime
        </p>
      </div>
    </section>
  )
}
