'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useAppData } from '@/context/AppContext'
import { useAuth } from '@/context/AuthContext'
import { formatCurrencyRounded, formatMonth, getMonthRange, getCurrentMonth, receivedInMonth, roundMoney } from '@/utils/helpers'
import { getMonthlyRevenue, getCollectionRate, getOccupancyRate, getOutstandingDues, getAvgMonthlyRevenue } from '@/utils/analyticsHelpers'
import BarChart from '@/components/analytics/BarChart'
import PageHeader from '@/components/ui/PageHeader'
import StatStrip from '@/components/ui/StatStrip'
import Panel from '@/components/ui/Panel'
import { Segmented } from '@/components/ui/Tabs'
import { page } from '@/components/ui/styles'

// ₹1.2L / ₹45k style labels for chart axes.
function compactINR(v) {
  if (v >= 1e7) return `₹${+(v / 1e7).toFixed(1)}Cr`
  if (v >= 1e5) return `₹${+(v / 1e5).toFixed(1)}L`
  if (v >= 1e3) return `₹${Math.round(v / 1e3)}k`
  return `₹${Math.round(v)}`
}
const signed = v => `${v < 0 ? '−' : ''}${formatCurrencyRounded(Math.abs(v))}`

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

  const rows = [...monthlyData].reverse().map(d => ({ ...d, ...profitData.find(p => p.month === d.month) }))
  const th = 'px-3 py-2.5 text-xs font-medium text-slate-500 text-right'
  const td = 'px-3 py-2.5 text-right tabular-nums'

  return (
    <div className={`${page} mx-auto max-w-5xl`}>
      <PageHeader
        title="Analytics"
        description="Collections, occupancy and profit over time."
        actions={<Segmented label="Time range" value={range} onChange={setRange} options={RANGES.map(r => ({ key: r, label: `${r} months` }))} />}
      />

      <StatStrip className="mb-6" items={[
        { label: 'Collection rate', value: `${collRate}%`, sub: `${formatMonth(currentMonth)}`, tone: collRate >= 80 ? 'default' : 'warning' },
        { label: 'Average collected', value: formatCurrencyRounded(avgRevenue), sub: `per month, last ${range}` },
        { label: 'Outstanding', value: formatCurrencyRounded(outstanding), sub: formatMonth(currentMonth), tone: outstanding > 0 ? 'warning' : 'default' },
        occupancyRate === null
          ? { label: 'Occupancy', value: '—', sub: 'Add rooms to track this' }
          : { label: 'Occupancy', value: `${occupancyRate}%`, sub: `${activeTenants.length} of ${totalBeds} beds` },
      ]} />

      <Panel title="Collected per month" description={`Last ${range} months. Hover a bar for the exact amount.`} className="mb-6" bodyClassName="px-5 pb-4 pt-6">
        <BarChart data={chartData} formatValue={formatCurrencyRounded} formatAxis={compactINR} highlightLast />
      </Panel>

      <Panel
        title="By month"
        description={showProfit ? <>Profit is money received minus <Link href="/dashboard/expenses" className="text-slate-700 underline underline-offset-2 hover:text-slate-900">expenses</Link> in the same month.</> : 'Billed and collected rent, month by month.'}
        actions={showProfit && (
          <p className="text-right text-xs text-slate-500">
            Profit, last {range} months<br />
            <span className={`text-sm font-semibold tabular-nums ${totalProfit < 0 ? 'text-red-600' : 'text-slate-900'}`}>{signed(totalProfit)}</span>
            {totals.received > 0 && <span> · {Math.round((totalProfit / totals.received) * 100)}% margin</span>}
          </p>
        )}
        className="mb-6"
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th scope="col" className="py-2.5 pl-5 pr-3 text-left text-xs font-medium text-slate-500">Month</th>
                <th scope="col" className={th}>Billed</th>
                <th scope="col" className={th}>Collected</th>
                <th scope="col" className={th}>Rate</th>
                {showProfit && <th scope="col" className={th}>Expenses</th>}
                {showProfit && <th scope="col" className={`${th} pr-5`}>Profit</th>}
                {!showProfit && <th scope="col" className={`${th} pr-5`}>Tenants billed</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map(d => {
                const rate = d.due > 0 ? Math.round((d.revenue / d.due) * 100) : null
                return (
                  <tr key={d.month} className="hover:bg-slate-50/70">
                    <td className="py-2.5 pl-5 pr-3 text-slate-900">{formatMonth(d.month)}{d.month === currentMonth && <span className="ml-1.5 text-xs text-slate-400">so far</span>}</td>
                    <td className={`${td} text-slate-600`}>{d.due ? formatCurrencyRounded(d.due) : <span className="text-slate-300">—</span>}</td>
                    <td className={`${td} text-slate-900`}>{formatCurrencyRounded(d.revenue)}</td>
                    <td className={`${td} ${rate === null ? 'text-slate-300' : rate >= 80 ? 'text-slate-600' : rate >= 50 ? 'text-amber-700' : 'text-red-600'}`}>{rate === null ? '—' : `${rate}%`}</td>
                    {showProfit && <td className={`${td} text-slate-600`}>{d.spent ? formatCurrencyRounded(d.spent) : <span className="text-slate-300">—</span>}</td>}
                    {showProfit && <td className={`${td} pr-5 font-medium ${d.profit < 0 ? 'text-red-600' : 'text-slate-900'}`}>{signed(d.profit)}</td>}
                    {!showProfit && <td className={`${td} pr-5 text-slate-600`}>{d.count}</td>}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Occupancy" bodyClassName="px-5 py-4">
        {occupancyRate === null ? (
          <p className="text-sm text-slate-500">
            Add your rooms and beds in <Link href="/dashboard/rooms" className="font-medium text-slate-900 underline underline-offset-2">Rooms</Link> to track occupancy.
          </p>
        ) : (
          <div className="flex items-center gap-4">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-label="Occupancy" aria-valuenow={occupancyRate} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full rounded-full bg-indigo-500" style={{ width: `${occupancyRate}%` }} />
            </div>
            <span className="w-12 text-right text-sm font-semibold tabular-nums text-slate-900">{occupancyRate}%</span>
          </div>
        )}
        <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-2 text-sm">
          <div><dt className="text-xs text-slate-500">Living here</dt><dd className="font-medium tabular-nums text-slate-900">{activeTenants.length}</dd></div>
          {totalBeds > 0 && <div><dt className="text-xs text-slate-500">Free beds</dt><dd className="font-medium tabular-nums text-slate-900">{Math.max(0, totalBeds - activeTenants.length)}</dd></div>}
          <div><dt className="text-xs text-slate-500">Moved out, all time</dt><dd className="font-medium tabular-nums text-slate-900">{vacated.length}</dd></div>
        </dl>
      </Panel>
    </div>
  )
}
