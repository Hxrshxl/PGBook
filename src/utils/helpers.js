// Shared, dependency-free helpers used by both the API routes and the UI.

// ── Money ─────────────────────────────────────────────────────

export function roundMoney(amount) {
  return Math.round((Number(amount) || 0) * 100) / 100
}

export function formatCurrency(amount) {
  return '₹' + Number(amount ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })
}

/** Whole rupees, for summary figures and charts. Individual dues and receipts keep paise. */
export function formatCurrencyRounded(amount) {
  return '₹' + Math.round(Number(amount ?? 0)).toLocaleString('en-IN')
}

/**
 * Splits `total` into `count` shares that add up exactly to `total`
 * (to the paisa). Leftover paise go to the first shares.
 */
export function splitAmount(total, count) {
  if (count <= 0) return []
  const totalPaise = Math.round(Number(total) * 100)
  const base = Math.floor(totalPaise / count)
  const remainder = totalPaise - base * count
  return Array.from({ length: count }, (_, i) => (base + (i < remainder ? 1 : 0)) / 100)
}

// ── Dates & months (all months are 'YYYY-MM' strings) ──────────

const pad = n => String(n).padStart(2, '0')

/** Today's date as 'YYYY-MM-DD' in the given IANA time zone (default: the runtime's local zone). */
export function todayISO(timeZone) {
  if (!timeZone) {
    const d = new Date()
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  }
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}

export function isValidDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const d = new Date(value + 'T00:00:00Z')
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(value)
}

export function isValidMonth(value) {
  return typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value)
}

export function formatMonth(isoMonth) {
  if (!isoMonth) return ''
  const [year, month] = isoMonth.split('-').map(Number)
  return new Date(year, month - 1, 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' })
}

export function formatDate(isoDate) {
  if (!isoDate) return '—'
  const d = new Date(String(isoDate).length === 10 ? isoDate + 'T00:00:00' : isoDate)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function getCurrentMonth(timeZone) {
  return todayISO(timeZone).slice(0, 7)
}

export function getPrevMonth(isoMonth) {
  const [year, month] = isoMonth.split('-').map(Number)
  const d = new Date(year, month - 2, 1)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
}

export function getNextMonth(isoMonth) {
  const [year, month] = isoMonth.split('-').map(Number)
  const d = new Date(year, month, 1)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
}

export function getMonthRange(count, endMonth = getCurrentMonth()) {
  const months = [endMonth]
  while (months.length < count) months.unshift(getPrevMonth(months[0]))
  return months
}

/** True if a tenant who moved in on `moveInDate` should be billed for `month`. */
export function isBillableMonth(moveInDate, month) {
  return !moveInDate || moveInDate.slice(0, 7) <= month
}

// ── Tenants & payments ────────────────────────────────────────

export function getActiveTenants(tenants) {
  return tenants.filter(t => t.status === 'active')
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
  return roundMoney((payment.rentAmount ?? 0) + (payment.utilityShare ?? 0))
}

export function getBalance(payment) {
  return Math.max(0, roundMoney(getTotalDue(payment) - (payment.amountPaid ?? 0)))
}

export function calcPaymentStatus(amountPaid, totalDue) {
  if (roundMoney(amountPaid) >= roundMoney(totalDue)) return 'paid'
  if (amountPaid > 0) return 'partial'
  return 'pending'
}

export const PAYMENT_METHOD_LABELS = { upi: 'UPI', cash: 'Cash', bank: 'Bank transfer', card: 'Card', other: 'Other' }

/**
 * The individual amounts received for a dues record. Records created before
 * payment history existed are shown as a single entry.
 */
export function getPaymentEntries(payment) {
  if (payment.transactions?.length) return payment.transactions
  if (payment.amountPaid > 0) {
    return [{ id: `legacy-${payment.id}`, amount: payment.amountPaid, date: payment.paidDate, method: 'other', note: '', createdAt: payment.updatedAt, legacy: true }]
  }
  return []
}

// ── Phone numbers ─────────────────────────────────────────────

/** Strips formatting and checks for a plausible phone number (10–15 digits). */
export function isValidPhone(phone) {
  const digits = String(phone ?? '').replace(/\D/g, '')
  return digits.length >= 10 && digits.length <= 15
}

/** Converts an Indian or international number into the digits-only form wa.me expects. */
export function toWhatsAppNumber(phone) {
  let digits = String(phone ?? '').replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1)
  if (digits.length === 10) return '91' + digits
  return digits
}

// ── Misc ──────────────────────────────────────────────────────

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
  return name.trim().split(/\s+/).map(n => n[0]).join('').toUpperCase().slice(0, 2)
}
