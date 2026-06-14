export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

export function formatCurrency(amount) {
  return '₹' + Number(amount ?? 0).toLocaleString('en-IN')
}

export function formatMonth(isoMonth) {
  if (!isoMonth) return ''
  const [year, month] = isoMonth.split('-').map(Number)
  return new Date(year, month - 1, 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' })
}

export function getCurrentMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export function getPrevMonth(isoMonth) {
  const [year, month] = isoMonth.split('-').map(Number)
  const d = new Date(year, month - 2, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function getNextMonth(isoMonth) {
  const [year, month] = isoMonth.split('-').map(Number)
  const d = new Date(year, month, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function getMonthRange(count) {
  const months = []
  const now = new Date()
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return months
}

export function getActiveTenants(tenants) {
  return tenants.filter(t => t.status === 'active')
}

export function getTenantById(tenants, id) {
  return tenants.find(t => t.id === id) ?? null
}

export function getTenantPayments(payments, tenantId) {
  return payments
    .filter(p => p.tenantId === tenantId)
    .sort((a, b) => b.month.localeCompare(a.month))
}

export function getMonthPayments(payments, month) {
  return payments.filter(p => p.month === month)
}

export function getTotalDue(payment) {
  return (payment.rentAmount ?? 0) + (payment.utilityShare ?? 0)
}

export function getBalance(payment) {
  return Math.max(0, getTotalDue(payment) - (payment.amountPaid ?? 0))
}

export function calcPaymentStatus(amountPaid, totalDue) {
  if (amountPaid >= totalDue) return 'paid'
  if (amountPaid > 0) return 'partial'
  return 'pending'
}

export function timeAgo(isoDate) {
  if (!isoDate) return ''
  const diff = Date.now() - new Date(isoDate).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

export function initials(name) {
  if (!name) return '?'
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}
