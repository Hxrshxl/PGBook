import { getMonthPayments, getActiveTenants, getTotalDue } from './helpers'

export function getMonthlyRevenue(payments, months) {
  return months.map(month => ({
    month,
    revenue: getMonthPayments(payments, month).reduce((s, p) => s + (p.amountPaid ?? 0), 0),
    due:     getMonthPayments(payments, month).reduce((s, p) => s + getTotalDue(p), 0),
  }))
}

export function getCollectionRate(payments, month) {
  const mps = getMonthPayments(payments, month)
  if (!mps.length) return 0
  const collected = mps.reduce((s, p) => s + (p.amountPaid ?? 0), 0)
  const due = mps.reduce((s, p) => s + getTotalDue(p), 0)
  return due > 0 ? Math.round((collected / due) * 100) : 0
}

export function getOccupancyRate(tenants) {
  if (!tenants.length) return 0
  const active = tenants.filter(t => t.status === 'active').length
  return Math.round((active / tenants.length) * 100)
}

export function getOutstandingDues(payments, month) {
  return getMonthPayments(payments, month).reduce((s, p) => {
    const bal = Math.max(0, getTotalDue(p) - (p.amountPaid ?? 0))
    return s + bal
  }, 0)
}

export function getAvgMonthlyRevenue(payments, months) {
  const totals = months.map(m => getMonthPayments(payments, m).reduce((s, p) => s + (p.amountPaid ?? 0), 0))
  const nonZero = totals.filter(v => v > 0)
  if (!nonZero.length) return 0
  return Math.round(nonZero.reduce((s, v) => s + v, 0) / nonZero.length)
}
