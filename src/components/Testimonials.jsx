'use client'
import { Star } from 'lucide-react'
import { motion } from 'framer-motion'
import { fadeUp, staggerContainer } from '../utils/animations'

const testimonials = [
  { name: 'Suresh Reddy',       role: 'PG Owner, Bangalore', rooms: '24 rooms', avatar: 'SR', color: 'bg-indigo-700',  rating: 5, quote: '"I used to spend 3-4 hours every month following up on rent. Now it takes me 20 minutes. The WhatsApp reminder draft feature alone is worth the subscription."' },
  { name: 'Kavitha Srinivasan', role: 'PG Owner, Pune',      rooms: '16 rooms', avatar: 'KS', color: 'bg-pink-700',    rating: 5, quote: '"The electricity bill splitting was my biggest headache. 16 tenants, uneven usage — I was always getting complaints. Now PGBook handles it and nobody argues."' },
  { name: 'Rajesh Malhotra',    role: 'PG Owner, Hyderabad', rooms: '30 rooms', avatar: 'RM', color: 'bg-emerald-700', rating: 5, quote: '"My tenants keep asking for rent receipts for their company reimbursements. Earlier I\'d write them by hand. Now one click and it\'s done. Tenants love it too."' },
  { name: 'Anita Desai',        role: 'PG Owner, Pune',      rooms: '12 rooms', avatar: 'AD', color: 'bg-orange-700',  rating: 5, quote: '"I was skeptical about paying ₹499/month but honestly the time I save is worth 10x that. Setup was 10 minutes and I was live the same day."' },
  { name: 'Mohammed Farooq',    role: 'PG Owner, Bangalore', rooms: '20 rooms', avatar: 'MF', color: 'bg-teal-700',    rating: 5, quote: '"The tenant portal is clean and my residents actually use it. Complaints come through the app now instead of random WhatsApp messages at midnight."' },
  { name: 'Deepika Nair',       role: 'PG Owner, Chennai',   rooms: '18 rooms', avatar: 'DN', color: 'bg-purple-700',  rating: 5, quote: '"Finally an app made for Indian PGs. Other tools feel like they were designed for apartments in the US. PGBook gets the messy reality of running a PG."' },
]

export default function Testimonials() {
  return (
    <section className="py-24 bg-white section-border">
      <div className="max-w-6xl mx-auto px-5 sm:px-8">
        <motion.div
          className="text-center mb-14"
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
        >
          <span className="text-indigo-600 text-sm font-semibold uppercase tracking-widest">Testimonials</span>
          <h2 className="text-4xl sm:text-5xl font-bold text-slate-900 mt-3 mb-4">PG owners who switched</h2>
          <p className="text-slate-500 text-lg max-w-xl mx-auto">Real owners. Real PGs. Real time saved.</p>
        </motion.div>

        <motion.div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.1 }}
        >
          {testimonials.map((t) => (
            <motion.div
              key={t.name}
              variants={fadeUp}
              className="bg-slate-50 hover:bg-white rounded-2xl p-6 border border-slate-100 hover:border-indigo-100 hover:shadow-lg transition-all duration-200 cursor-default"
            >
              <div className="flex gap-1 mb-4">
                {[...Array(t.rating)].map((_, i) => (
                  <Star key={i} size={13} className="text-amber-400 fill-amber-400" />
                ))}
              </div>
              <p className="text-slate-600 text-sm leading-relaxed mb-5 italic">{t.quote}</p>
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-full ${t.color} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
                  {t.avatar}
                </div>
                <div>
                  <p className="text-slate-900 font-semibold text-sm">{t.name}</p>
                  <p className="text-slate-500 text-xs">{t.role} · {t.rooms}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Stats bar */}
        <motion.div
          className="mt-14 grid grid-cols-2 sm:grid-cols-4 gap-6 bg-indigo-950 rounded-2xl p-8"
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
        >
          {[
            { value: '500+',  label: 'PGs managed'       },
            { value: '8,000+', label: 'Tenants served'   },
            { value: '₹4Cr+', label: 'Rent processed'    },
            { value: '4.9/5', label: 'Owner satisfaction' },
          ].map(({ value, label }) => (
            <div key={label} className="text-center">
              <p className="text-white text-3xl font-bold" style={{ fontFamily: 'Space Grotesk' }}>{value}</p>
              <p className="text-indigo-400 text-sm mt-1">{label}</p>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
