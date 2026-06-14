'use client'
export default function StatCard({ title, value, sub, icon: Icon, color, className = '' }) {
  return (
    <div className={`bg-white rounded-2xl border border-slate-100 p-5 shadow-sm ${className}`}>
      {Icon && (
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${color}`}>
          <Icon size={18} />
        </div>
      )}
      <p className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Space Grotesk' }}>
        {value}
      </p>
      {sub && <p className="text-slate-400 text-xs mt-0.5">{sub}</p>}
      <p className="text-slate-500 text-xs font-medium mt-1">{title}</p>
    </div>
  )
}
