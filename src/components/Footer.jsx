'use client'
import { Building2, Mail, Share2, Globe } from 'lucide-react'

const links = {
  Product: ['Features', 'Pricing', 'Changelog', 'Roadmap'],
  Company: ['About', 'Blog', 'Careers', 'Press'],
  Legal: ['Privacy Policy', 'Terms of Service', 'Refund Policy'],
  Support: ['Help Center', 'Contact Us', 'Community', 'Status'],
}

export default function Footer() {
  return (
    <footer className="bg-[#0a0e1a] border-t border-white/5">
      <div className="max-w-6xl mx-auto px-5 sm:px-8 py-16">
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-8 mb-12">
          {/* Brand */}
          <div className="col-span-2">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
                <Building2 size={16} className="text-white" />
              </div>
              <span
                style={{ fontFamily: 'Space Grotesk, sans-serif' }}
                className="text-white font-bold text-xl tracking-tight"
              >
                PG<span className="text-indigo-400">Book</span>
              </span>
            </div>
            <p className="text-slate-500 text-sm leading-relaxed mb-5 max-w-xs">
              The operating system for PG owners. Tenant management, rent collection, and utility billing — simplified.
            </p>
            <div className="flex gap-3">
              <a href="#" className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors">
                <Share2 size={14} />
              </a>
              <a href="#" className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors">
                <Globe size={14} />
              </a>
              <a href="mailto:hello@pgbook.in" className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors">
                <Mail size={14} />
              </a>
            </div>
          </div>

          {/* Links */}
          {Object.entries(links).map(([category, items]) => (
            <div key={category}>
              <p className="text-white font-semibold text-sm mb-4">{category}</p>
              <ul className="space-y-2.5">
                {items.map((item) => (
                  <li key={item}>
                    <a href="#" className="text-slate-500 hover:text-slate-300 text-sm transition-colors">
                      {item}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-white/5 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-slate-500 text-sm">
            © 2025 PGBook Technologies Pvt Ltd · Made in India
          </p>
          <p className="text-slate-600 text-xs">
            Built for PG owners in Pune · Bangalore · Hyderabad · Mumbai
          </p>
        </div>
      </div>
    </footer>
  )
}
