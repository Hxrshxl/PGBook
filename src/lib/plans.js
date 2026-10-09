// Plans as advertised on the pricing page, and what each one allows.
// Prices are in rupees and include GST. Yearly plans are billed once a year at
// 12 × the yearly per-month price.
export const TRIAL_DAYS = 14

export const PLANS = {
  trial: {
    label: 'Free trial', monthlyPrice: 0, yearlyMonthlyPrice: 0,
    maxTenants: 50, maxProperties: 5, maxStaff: 10,
    blurb: 'Everything, for 14 days',
  },
  starter: {
    label: 'Starter', monthlyPrice: 249, yearlyMonthlyPrice: 199,
    maxTenants: 10, maxProperties: 1, maxStaff: 0,
    blurb: 'For small PGs with up to 10 tenants',
  },
  pro: {
    label: 'Pro', monthlyPrice: 499, yearlyMonthlyPrice: 399,
    maxTenants: 50, maxProperties: 1, maxStaff: 3,
    blurb: 'For active PGs with up to 50 tenants',
  },
  multi: {
    label: 'Multi-PG', monthlyPrice: 999, yearlyMonthlyPrice: 799,
    maxTenants: Infinity, maxProperties: 5, maxStaff: 10,
    blurb: 'For owners running 2–5 PGs from one account',
  },
}

export const PLAN_IDS = Object.keys(PLANS)
export const PAID_PLAN_IDS = PLAN_IDS.filter(id => PLANS[id].monthlyPrice > 0)
export const INTERVALS = ['monthly', 'yearly']

/** What is charged per billing cycle (₹, GST included). */
export function planPrice(plan, interval = 'monthly') {
  const p = PLANS[plan]
  if (!p) return 0
  return interval === 'yearly' ? p.yearlyMonthlyPrice * 12 : p.monthlyPrice
}

/** Monthly-equivalent revenue of a subscription, for MRR. */
export function monthlyValue(plan, interval = 'monthly') {
  return interval === 'yearly' ? planPrice(plan, 'yearly') / 12 : planPrice(plan, 'monthly')
}

export const LIMIT_LABELS = {
  tenants: ['maxTenants', 'active tenants'],
  properties: ['maxProperties', 'properties'],
  staff: ['maxStaff', 'staff logins'],
}

/** Human summary of a plan's limits, e.g. "Up to 50 tenants · 1 property · 3 staff logins". */
export function limitSummary(plan) {
  const p = PLANS[plan]
  if (!p) return ''
  const tenants = Number.isFinite(p.maxTenants) ? `Up to ${p.maxTenants} tenants` : 'Unlimited tenants'
  const properties = p.maxProperties === 1 ? '1 property' : `Up to ${p.maxProperties} properties`
  const staff = p.maxStaff ? `${p.maxStaff} staff logins` : 'Owner login only'
  return `${tenants} · ${properties} · ${staff}`
}
