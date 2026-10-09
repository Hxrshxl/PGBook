// What the owner's Subscription page shows.
import Invoice from './models/Invoice.js'
import { PAID_PLAN_IDS, PLANS, limitSummary } from './plans.js'
import { billingState, limitsFor, planBlocker, STATUS_LABELS } from './subscription.js'
import { usageFor } from './planLimits.js'
import { billingProvider } from './billingProvider.js'

const finite = v => (Number.isFinite(v) ? v : null)

export async function billingOverview(org, request) {
  const state = billingState(org)
  const usage = await usageFor(org._id)
  const limits = limitsFor(state)
  const invoices = await Invoice.find({ orgId: org._id }).sort({ issuedAt: -1 }).limit(24)
  const b = org.billing ?? {}
  return {
    state: { ...state, statusLabel: STATUS_LABELS[state.status] },
    subscription: {
      provider: b.provider ?? null,
      hasSubscription: !!b.subscriptionId,
      pending: b.pending?.subscriptionId ? { plan: b.pending.plan, interval: b.pending.interval, createdAt: b.pending.createdAt } : null,
      lastFailureAt: b.lastFailureAt ?? null,
    },
    usage,
    limits: { tenants: finite(limits.tenants), properties: finite(limits.properties), staff: finite(limits.staff) },
    plans: PAID_PLAN_IDS.map(id => ({
      id,
      label: PLANS[id].label,
      blurb: PLANS[id].blurb,
      monthlyPrice: PLANS[id].monthlyPrice,
      yearlyMonthlyPrice: PLANS[id].yearlyMonthlyPrice,
      limits: { tenants: finite(PLANS[id].maxTenants), properties: PLANS[id].maxProperties, staff: PLANS[id].maxStaff },
      summary: limitSummary(id),
      blocker: planBlocker(id, usage),
    })),
    provider: billingProvider(request),
    details: {
      legalName: b.details?.legalName ?? '', gstin: b.details?.gstin ?? '', address: b.details?.address ?? '',
      stateCode: b.details?.stateCode ?? '', email: b.details?.email ?? '',
    },
    invoices: invoices.map(i => ({ id: i._id.toString(), number: i.number, issuedAt: i.issuedAt, total: i.total, plan: i.plan, interval: i.interval, status: i.status })),
  }
}
