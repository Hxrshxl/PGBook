export default function ComingSoon({ icon: Icon, title, description, phase }) {
  return (
    <div className="p-6 lg:p-8">
      <h1 className="text-2xl font-bold text-slate-900 mb-1" style={{ fontFamily: 'Space Grotesk' }}>
        {title}
      </h1>
      <p className="text-slate-500 text-sm mb-8">{description}</p>

      <div className="max-w-sm bg-white border border-slate-100 rounded-2xl p-10 text-center shadow-sm">
        <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Icon size={26} className="text-indigo-500" />
        </div>
        <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wider mb-1">{phase}</p>
        <h3 className="font-bold text-slate-900 text-base mb-2">Coming soon</h3>
        <p className="text-slate-400 text-sm leading-relaxed">
          This feature is planned and will be built in the next phase.
        </p>
      </div>
    </div>
  )
}
