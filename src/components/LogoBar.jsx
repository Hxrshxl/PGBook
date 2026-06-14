'use client'
export default function LogoBar() {
  const cities = ['Pune', 'Bangalore', 'Hyderabad', 'Mumbai', 'Chennai', 'Delhi NCR']

  return (
    <section className="bg-slate-50 border-y border-slate-100 py-6">
      <div className="max-w-6xl mx-auto px-5 sm:px-8">
        <p className="text-center text-slate-400 text-xs font-medium uppercase tracking-widest mb-5">
          Trusted by PG owners across India's top cities
        </p>
        <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-10">
          {cities.map((city) => (
            <div key={city} className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-indigo-500/60" />
              <span className="text-slate-500 font-semibold text-sm tracking-wide">{city}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
