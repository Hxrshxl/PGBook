'use client'
import { useAppData } from '../../context/AppContext'
import { formatCurrency, formatMonth, getMonthRange, getCurrentMonth } from '../../utils/helpers'
import { getMonthlyRevenue, getCollectionRate, getOccupancyRate, getOutstandingDues, getAvgMonthlyRevenue } from '../../utils/analyticsHelpers'
import BarChart from '../../components/analytics/BarChart'

export default function AnalyticsPage() {
  const { tenants, payments } = useAppData()
  const currentMonth = getCurrentMonth()
  const months6 = getMonthRange(6)

  const monthlyData  = getMonthlyRevenue(payments, months6)
  const collRate     = getCollectionRate(payments, currentMonth)
  const occupancyRate = getOccupancyRate(tenants)
  const outstanding  = getOutstandingDues(payments, currentMonth)
  const avgRevenue   = getAvgMonthlyRevenue(payments, months6)

  const activeTenants = tenants.filter(t => t.status === 'active')
  const vacated       = tenants.filter(t => t.status === 'vacated')

  const chartData = monthlyData.map(d => ({
    label: formatMonth(d.month).split(' ')[0].slice(0, 3),
    value: d.revenue,
  }))

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Space Grotesk' }}>Revenue Analytics</h1>
        <p className="text-slate-500 text-sm mt-1">Financial overview and occupancy trends</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Collection Rate',    value: `${collRate}%`,             sub: 'this month',    color: collRate >= 80 ? 'text-emerald-600' : 'text-amber-600' },
          { label: 'Avg Monthly Revenue', value: formatCurrency(avgRevenue), sub: 'last 6 months',  color: 'text-indigo-600' },
          { label: 'Outstanding Dues',   value: formatCurrency(outstanding), sub: 'this month',    color: 'text-red-500' },
          { label: 'Occupancy Rate',     value: `${occupancyRate}%`,        sub: `${activeTenants.length} of ${tenants.length} rooms`, color: occupancyRate >= 80 ? 'text-emerald-600' : 'text-amber-600' },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
            <p className={`text-2xl font-bold mb-1 ${k.color}`} style={{ fontFamily: 'Space Grotesk' }}>{k.value}</p>
            <p className="text-slate-700 text-sm font-medium">{k.label}</p>
            <p className="text-slate-400 text-xs mt-0.5">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Revenue Chart */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
        <h2 className="font-semibold text-slate-900 mb-1" style={{ fontFamily: 'Space Grotesk' }}>Monthly Revenue</h2>
        <p className="text-slate-400 text-xs mb-6">Last 6 months — hover bars for exact amount</p>
        <BarChart
          data={chartData}
          color="bg-indigo-500"
          formatValue={v => formatCurrency(v)}
        />
      </div>

      {/* Monthly Breakdown Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900" style={{ fontFamily: 'Space Grotesk' }}>Monthly Breakdown</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                {['Month', 'Collected', 'Total Due', 'Collection Rate', 'Payments'].map((h, i) => (
                  <th key={h} className={`px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider ${i === 0 ? 'text-left' : 'text-right'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {[...monthlyData].reverse().map(d => {
                const rate = d.due > 0 ? Math.round((d.revenue / d.due) * 100) : 0
                const monthPmts = payments.filter(p => p.month === d.month)
                return (
                  <tr key={d.month} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-3.5 font-medium text-slate-900">{formatMonth(d.month)}</td>
                    <td className="px-5 py-3.5 text-right text-emerald-600 font-semibold">{formatCurrency(d.revenue)}</td>
                    <td className="px-5 py-3.5 text-right text-slate-600">{formatCurrency(d.due)}</td>
                    <td className="px-5 py-3.5 text-right">
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full ${rate >= 80 ? 'bg-emerald-50 text-emerald-700' : rate >= 50 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'}`}>
                        {rate}%
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right text-slate-500">{monthPmts.length}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Occupancy */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
        <h2 className="font-semibold text-slate-900 mb-4" style={{ fontFamily: 'Space Grotesk' }}>Tenant Occupancy</h2>
        <div className="flex items-center gap-4 mb-4">
          <div className="flex-1 bg-slate-100 rounded-full h-4 overflow-hidden">
            <div
              className="h-full bg-indigo-500 rounded-full transition-all duration-700"
              style={{ width: `${occupancyRate}%` }}
            />
          </div>
          <span className="text-slate-700 font-bold text-lg w-14 text-right" style={{ fontFamily: 'Space Grotesk' }}>{occupancyRate}%</span>
        </div>
        <div className="flex items-center gap-6 text-sm text-slate-500">
          <span><span className="font-semibold text-slate-900">{activeTenants.length}</span> active</span>
          <span><span className="font-semibold text-slate-900">{vacated.length}</span> vacated</span>
          <span><span className="font-semibold text-slate-900">{tenants.length}</span> total</span>
        </div>
      </div>
    </div>
  )
}
