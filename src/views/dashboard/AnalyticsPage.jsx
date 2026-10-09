'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useAppData } from '@/context/AppContext'
import { useAuth } from '@/context/AuthContext'
import { formatCurrencyRounded, formatMonth, getMonthRange, getCurrentMonth, receivedInMonth, roundMoney } from '@/utils/helpers'
import { getMonthlyRevenue, getCollectionRate, getOccupancyRate, getOutstandingDues, getAvgMonthlyRevenue } from '@/utils/analyticsHelpers'
import BarChart from '@/components/analytics/BarChart'

const RANGES = [6, 12]

export default function AnalyticsPage() {
  const { tenants, payments, expenses, rooms, pgSettings } = useAppData()
  const { can } = useAuth()
  const showProfit = can('expenses.view')
  const totalBeds = rooms.length ? rooms.reduce((s, r) => s + r.capacity, 0) : pgSettings.totalBeds
  const [range, setRange] = useState(6)
  const currentMonth = getCurrentMonth()
  const months = getMonthRange(range)

  const activeTenants = tenants.filter(t => t.status === 'active')
  const vacated = tenants.filter(t => t.status === 'vacated')
  const monthlyData = getMonthlyRevenue(payments, months)
  const collRate = getCollectionRate(payments, currentMonth)
  const occupancyRate = getOccupancyRate(activeTenants.length, totalBeds)
  const outstanding = getOutstandingDues(payments, currentMonth)
  const avgRevenue = getAvgMonthlyRevenue(payments, months)

  // Cash basis: money received during the month minus money spent during it.
  const profitData = months.map(month => {
    const received = receivedInMonth(payments, month)
    const spent = roundMoney(expenses.filter(e => e.month === month).reduce((s, e) => s + e.amount, 0))
    return { month, received, spent, profit: roundMoney(received - spent) }
  })
  const totals = profitData.reduce((t, d) => ({ received: t.received + d.received, spent: t.spent + d.spent }), { received: 0, spent: 0 })
  const totalProfit = roundMoney(totals.received - totals.spent)

  const chartData = monthlyData.map(d => ({
    label: new Date(d.month + '-01T00:00:00').toLocaleString('en-IN', { month: 'short' }),
    value: d.revenue,
  }))

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Revenue Analytics</h1>
          <p className="text-slate-500 text-sm mt-1">Financial overview and occupancy trends</p>
        </div>
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit" role="group" aria-label="Time range">
          {RANGES.map(r => (
            <button key={r} onClick={() => setRange(r)} aria-pressed={range === r}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${range === r ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              {r} months
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Collection rate',     value: `${collRate}%`,              sub: 'this month',    color: collRate >= 80 ? 'text-emerald-600' : 'text-amber-600' },
          { label: 'Avg monthly revenue', value: formatCurrencyRounded(avgRevenue), sub: `last ${range} months`, color: 'text-indigo-600' },
          { label: 'Outstanding dues',    value: formatCurrencyRounded(outstanding), sub: 'this month',    color: 'text-red-500' },
          {
            label: 'Occupancy',
            value: occupancyRate === null ? '—' : `${occupancyRate}%`,
            sub: occupancyRate === null ? 'add rooms in Rooms & Beds' : `${activeTenants.length} of ${totalBeds} beds`,
            color: occupancyRate === null ? 'text-slate-400' : occupancyRate >= 80 ? 'text-emerald-600' : 'text-amber-600',
          },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
            <p className={`text-xl sm:text-2xl font-bold mb-1 ${k.color}`}>{k.value}</p>
            <p className="text-slate-700 text-sm font-medium">{k.label}</p>
            <p className="text-slate-400 text-xs mt-0.5">{k.sub}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
        <h2 className="font-semibold text-slate-900 mb-1">Monthly Revenue</h2>
        <p className="text-slate-400 text-xs mb-6">Amount collected, last {range} months — hover a bar for the exact amount</p>
        <BarChart data={chartData} color="bg-indigo-500" formatValue={formatCurrencyRounded} />
      </div>

      {showProfit && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h2 className="font-semibold text-slate-900">Profit & Loss</h2>
              <p className="text-slate-400 text-xs mt-0.5">Money received minus <Link href="/dashboard/expenses" className="text-indigo-600 hover:text-indigo-700">expenses</Link>, by the month it happened</p>
            </div>
            <p className="text-sm text-slate-500">
              Last {range} months: <span className={`font-bold ${totalProfit >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{totalProfit >= 0 ? '' : '−'}{formatCurrencyRounded(Math.abs(totalProfit))}</span>
              {totals.received > 0 && <span className="text-slate-400"> · {Math.round((totalProfit / totals.received) * 100)}% margin</span>}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[480px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  {['Month', 'Received', 'Expenses', 'Profit'].map((h, i) => (
                    <th key={h} scope="col" className={`px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider ${i === 0 ? 'text-left' : 'text-right'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {[...profitData].reverse().map(d => (
                  <tr key={d.month} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-3.5 font-medium text-slate-900">{formatMonth(d.month)}</td>
                    <td className="px-5 py-3.5 text-right text-emerald-600 font-medium">{formatCurrencyRounded(d.received)}</td>
                    <td className="px-5 py-3.5 text-right text-slate-600">{d.spent ? formatCurrencyRounded(d.spent) : '—'}</td>
                    <td className={`px-5 py-3.5 text-right font-semibold ${d.profit >= 0 ? 'text-slate-900' : 'text-red-600'}`}>{d.profit < 0 && '−'}{formatCurrencyRounded(Math.abs(d.profit))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Monthly Breakdown</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[520px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                {['Month', 'Collected', 'Total Due', 'Collection Rate', 'Tenants billed'].map((h, i) => (
                  <th key={h} scope="col" className={`px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider ${i === 0 ? 'text-left' : 'text-right'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {[...monthlyData].reverse().map(d => {
                const rate = d.due > 0 ? Math.round((d.revenue / d.due) * 100) : 0
                return (
                  <tr key={d.month} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-3.5 font-medium text-slate-900">{formatMonth(d.month)}</td>
                    <td className="px-5 py-3.5 text-right text-emerald-600 font-semibold">{formatCurrencyRounded(d.revenue)}</td>
                    <td className="px-5 py-3.5 text-right text-slate-600">{formatCurrencyRounded(d.due)}</td>
                    <td className="px-5 py-3.5 text-right">
                      {d.due > 0 ? (
                        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${rate >= 80 ? 'bg-emerald-50 text-emerald-700' : rate >= 50 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'}`}>
                          {rate}%
                        </span>
                      ) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-5 py-3.5 text-right text-slate-500">{d.count}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
        <h2 className="font-semibold text-slate-900 mb-4">Occupancy</h2>
        {occupancyRate === null ? (
          <p className="text-sm text-slate-500">
            Add your rooms and beds in <Link href="/dashboard/rooms" className="text-indigo-600 font-medium hover:text-indigo-700">Rooms & Beds</Link> to track occupancy.
          </p>
        ) : (
          <div className="flex items-center gap-4 mb-4">
            <div className="flex-1 bg-slate-100 rounded-full h-4 overflow-hidden" role="progressbar" aria-valuenow={occupancyRate} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full bg-indigo-500 rounded-full transition-all duration-700" style={{ width: `${occupancyRate}%` }} />
            </div>
            <span className="text-slate-700 font-bold text-lg w-14 text-right">{occupancyRate}%</span>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-500 mt-4">
          <span><span className="font-semibold text-slate-900">{activeTenants.length}</span> active</span>
          {totalBeds > 0 && <span><span className="font-semibold text-slate-900">{Math.max(0, totalBeds - activeTenants.length)}</span> beds free</span>}
          <span><span className="font-semibold text-slate-900">{vacated.length}</span> vacated (all time)</span>
        </div>
      </div>
    </div>
  )
}
