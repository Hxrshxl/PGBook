'use client'
import Link from 'next/link'
import { ArrowRight, IndianRupee } from 'lucide-react'
import { motion } from 'framer-motion'
import { fadeUp } from '@/utils/animations'

export default function CTA() {
  return (
    <section className="py-24 bg-white section-border">
      <div className="max-w-4xl mx-auto px-5 sm:px-8 text-center">
        <div className="relative">
          <div className="absolute inset-0 -m-16 bg-linear-to-br from-indigo-50 to-orange-50 rounded-3xl" />

          <motion.div
            className="relative"
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
          >
            <span className="text-indigo-600 text-sm font-semibold uppercase tracking-widest">Get started today</span>

            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-slate-900 mt-4 mb-5 leading-tight">
              Stop managing your PG{' '}
              <span className="gradient-text">on WhatsApp</span>
            </h2>

            <p className="text-slate-500 text-lg sm:text-xl leading-relaxed max-w-2xl mx-auto mb-10">
              Join 500+ PG owners who switched from handwritten registers and group chats to PGBook.
              Your first 14 days are completely free.
            </p>

            <div className="inline-flex items-center gap-3 bg-indigo-50 border border-indigo-200 rounded-2xl px-6 py-4 mb-10 text-left">
              <IndianRupee size={20} className="text-indigo-600 shrink-0" />
              <div>
                <p className="text-slate-900 font-semibold text-sm">Quick math for a 20-room PG</p>
                <p className="text-slate-500 text-xs mt-0.5">
                  ₹2L+/month revenue · ₹499/month PGBook · That's 0.25% of revenue for zero collection headache
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/signup"
                className="glow-btn inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-400 text-white font-bold px-8 py-4 rounded-xl text-base transition-all duration-200 w-full sm:w-auto justify-center"
              >
                Start free 14-day trial
                <ArrowRight size={18} />
              </Link>
              <p className="text-slate-400 text-sm">No card needed · Cancel anytime</p>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
