'use client'
import Link from 'next/link'
import { ArrowRight, CheckCircle2, Star, TrendingUp, Bell, FileText } from 'lucide-react'
import { motion } from 'framer-motion'
import { fadeUp, staggerContainer } from '@/utils/animations'

const badges = [
  { icon: CheckCircle2, text: 'No setup fees',       color: 'text-emerald-400' },
  { icon: Star,         text: '4.9/5 owner rating',  color: 'text-amber-400'  },
  { icon: TrendingUp,   text: '500+ PGs onboard',    color: 'text-indigo-400' },
]

export default function Hero() {
  return (
    <section className="hero-bg min-h-screen flex items-center pt-16 relative overflow-hidden">
      {/* Grid overlay */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      <div className="max-w-6xl mx-auto px-5 sm:px-8 py-24 relative">
        <motion.div
          className="max-w-4xl mx-auto text-center"
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
        >
          {/* Eyebrow */}
          <motion.div variants={fadeUp} className="inline-flex items-center gap-2 bg-indigo-950/60 border border-indigo-500/30 rounded-full px-4 py-1.5 mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-indigo-300 text-sm font-medium">Now available — Pune, Bangalore & Hyderabad</span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            variants={fadeUp}
            className="text-5xl sm:text-6xl lg:text-7xl font-bold text-white leading-[1.1] tracking-tight mb-6"
          >
            The operating system{' '}
            <span className="gradient-text">for PG owners</span>
          </motion.h1>

          <motion.p variants={fadeUp} className="text-slate-400 text-lg sm:text-xl leading-relaxed max-w-2xl mx-auto mb-10">
            Manage tenants, collect rent, split utility bills, and send WhatsApp reminders —
            all from one dashboard. Built for the Indian PG owner who runs on instinct and post-its.
          </motion.p>

          {/* CTAs */}
          <motion.div variants={fadeUp} className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
            <Link
              href="/signup"
              className="glow-btn inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-400 text-white font-semibold px-7 py-3.5 rounded-xl text-base transition-all duration-200 w-full sm:w-auto justify-center"
            >
              Start 14-day free trial
              <ArrowRight size={18} />
            </Link>
            <a
              href="#how-it-works"
              className="inline-flex items-center gap-2 border border-white/15 hover:border-white/30 text-white font-semibold px-7 py-3.5 rounded-xl text-base transition-all duration-200 w-full sm:w-auto justify-center hover:bg-white/5"
            >
              See how it works
            </a>
          </motion.div>

          {/* Trust badges */}
          <motion.div variants={fadeUp} className="flex flex-wrap items-center justify-center gap-6">
            {badges.map(({ icon: Icon, text, color }) => (
              <div key={text} className="flex items-center gap-2">
                <Icon size={16} className={color} />
                <span className="text-slate-400 text-sm">{text}</span>
              </div>
            ))}
          </motion.div>
        </motion.div>

        {/* Hero visual — dashboard mockup with framer-motion float */}
        <motion.div
          className="mt-20 relative max-w-5xl mx-auto"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: [0, -8, 0] }}
          transition={{
            opacity: { duration: 0.6, delay: 0.5 },
            y: { delay: 0.5, duration: 0.6, times: [0, 0.5, 1], ease: 'easeOut', repeat: Infinity, repeatType: 'mirror', repeatDelay: 0 },
          }}
        >
          <div className="absolute -inset-1 bg-gradient-to-r from-indigo-600 to-orange-500 rounded-2xl opacity-20 blur-lg" />
          <div className="relative bg-[#111827] border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
            {/* Browser bar */}
            <div className="flex items-center gap-2 px-4 py-3 bg-[#0d1117] border-b border-white/5">
              <div className="flex gap-1.5">
                <span className="w-3 h-3 rounded-full bg-red-500/70" />
                <span className="w-3 h-3 rounded-full bg-amber-500/70" />
                <span className="w-3 h-3 rounded-full bg-emerald-500/70" />
              </div>
              <div className="flex-1 mx-4 bg-white/5 rounded-md px-3 py-1 text-xs text-slate-500 font-mono text-center">
                app.pgbook.in/dashboard
              </div>
            </div>

            {/* Dashboard content */}
            <div className="p-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="dashboard-card rounded-xl p-4">
                <p className="text-slate-500 text-xs mb-1">Monthly Revenue</p>
                <p className="text-white font-bold text-2xl" style={{ fontFamily: 'Space Grotesk' }}>₹2,40,000</p>
                <p className="text-emerald-400 text-xs mt-1">+8% vs last month</p>
              </div>
              <div className="dashboard-card rounded-xl p-4">
                <p className="text-slate-500 text-xs mb-1">Rent Collected</p>
                <p className="text-white font-bold text-2xl" style={{ fontFamily: 'Space Grotesk' }}>18/20</p>
                <p className="text-amber-400 text-xs mt-1">2 pending reminders</p>
              </div>
              <div className="dashboard-card rounded-xl p-4">
                <p className="text-slate-500 text-xs mb-1">Active Tenants</p>
                <p className="text-white font-bold text-2xl" style={{ fontFamily: 'Space Grotesk' }}>20</p>
                <p className="text-slate-500 text-xs mt-1">2 vacancies</p>
              </div>

              <div className="sm:col-span-2 dashboard-card rounded-xl p-4">
                <p className="text-slate-400 text-xs font-semibold mb-3 uppercase tracking-wider">Recent Payments</p>
                {[
                  { name: 'Ravi Sharma',  room: 'A-204', amount: '₹12,000', time: '2m ago',    status: 'paid'    },
                  { name: 'Priya Menon',  room: 'B-102', amount: '₹10,500', time: '1h ago',    status: 'paid'    },
                  { name: 'Aakash Patel', room: 'A-301', amount: '₹11,000', time: 'Due today', status: 'pending' },
                ].map((t) => (
                  <div key={t.name} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-indigo-900 flex items-center justify-center text-indigo-300 text-xs font-bold">
                        {t.name[0]}
                      </div>
                      <div>
                        <p className="text-white text-xs font-medium">{t.name}</p>
                        <p className="text-slate-500 text-xs">{t.room}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-white text-xs font-semibold">{t.amount}</p>
                      <span className={`text-xs ${t.status === 'paid' ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {t.time}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="dashboard-card rounded-xl p-4">
                <p className="text-slate-400 text-xs font-semibold mb-3 uppercase tracking-wider">Quick Actions</p>
                <div className="space-y-2">
                  <button className="w-full flex items-center gap-2 bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-600/30 text-indigo-300 text-xs font-medium px-3 py-2 rounded-lg transition-colors">
                    <Bell size={12} /> Send rent reminders
                  </button>
                  <button className="w-full flex items-center gap-2 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-600/30 text-emerald-300 text-xs font-medium px-3 py-2 rounded-lg transition-colors">
                    <FileText size={12} /> Generate receipts
                  </button>
                  <button className="w-full flex items-center gap-2 bg-amber-600/20 hover:bg-amber-600/30 border border-amber-600/30 text-amber-300 text-xs font-medium px-3 py-2 rounded-lg transition-colors">
                    <TrendingUp size={12} /> Split utility bills
                  </button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
