import { getMonthPayments, getTotalDue, getBalance } from './helpers.js'

export function getMonthlyRevenue(payments, months) {
  return months.map(month => {
    const mps = getMonthPayments(payments, month)
    return {
      month,
      revenue: mps.reduce((s, p) => s + (p.amountPaid ?? 0), 0),
      due:     mps.reduce((s, p) => s + getTotalDue(p), 0),
      count:   mps.length,
    }
  })
}

export function getCollectionRate(payments, month) {
  const mps = getMonthPayments(payments, month)
  const collected = mps.reduce((s, p) => s + (p.amountPaid ?? 0), 0)
  const due = mps.reduce((s, p) => s + getTotalDue(p), 0)
  return due > 0 ? Math.round((collected / due) * 100) : 0
}

/** Active tenants as a share of total beds; null when bed capacity isn't configured. */
export function getOccupancyRate(activeCount, totalBeds) {
  if (!totalBeds) return null
  return Math.min(100, Math.round((activeCount / totalBeds) * 100))
}

export function getOutstandingDues(payments, month) {
  return getMonthPayments(payments, month).reduce((s, p) => s + getBalance(p), 0)
}

export function getAvgMonthlyRevenue(payments, months) {
  const totals = months.map(m => getMonthPayments(payments, m).reduce((s, p) => s + (p.amountPaid ?? 0), 0))
  const nonZero = totals.filter(v => v > 0)
  if (!nonZero.length) return 0
  return Math.round(nonZero.reduce((s, v) => s + v, 0) / nonZero.length)
}
