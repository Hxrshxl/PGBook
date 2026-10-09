// Plan usage and limits. Adding tenant #51 on Pro asks to upgrade; recording
// payments, receipts and exports never count against a limit.
import Tenant from './models/Tenant.js'
import Property from './models/Property.js'
import Membership from './models/Membership.js'
import { ApiError } from './api.js'
import { PLANS, LIMIT_LABELS } from './plans.js'
import { billingState, limitsFor } from './subscription.js'

export async function usageFor(orgId) {
  const [tenants, properties, staff] = await Promise.all([
    Tenant.countDocuments({ userId: orgId, status: 'active' }),
    Property.countDocuments({ orgId, status: 'active' }),
    Membership.countDocuments({ orgId, status: { $in: ['invited', 'active'] } }),
  ])
  return { tenants, properties, staff }
}

/** Throws a 403 PLAN_LIMIT error if adding `adding` more of `kind` would exceed the plan. */
export async function assertWithinLimit(org, kind, adding = 1) {
  const state = billingState(org)
  const limit = limitsFor(state)[kind]
  if (!Number.isFinite(limit)) return
  const usage = await usageFor(org._id)
  if (usage[kind] + adding <= limit) return
  const [, noun] = LIMIT_LABELS[kind]
  const planLabel = PLANS[state.plan].label
  const next = state.plan === 'trial' ? 'a paid plan' : kind === 'tenants' && state.plan === 'starter' ? 'Pro' : 'Multi-PG'
  throw new ApiError(403, limit === 0
    ? `${planLabel} doesn't include ${noun}. Upgrade to ${next} in Subscription.`
    : `${planLabel} allows ${limit} ${noun} and you have ${usage[kind]}. Upgrade to ${next} in Subscription to add more.`, 'PLAN_LIMIT')
}
