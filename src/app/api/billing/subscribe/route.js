import { route, readJson, json, ApiError } from '@/lib/api'
import { billingProvider, createSubscription } from '@/lib/billingProvider'
import { usageFor } from '@/lib/planLimits'
import { INTERVALS, PAID_PLAN_IDS, PLANS } from '@/lib/plans'
import { billingState, planBlocker } from '@/lib/subscription'

// Starts a checkout for a plan. The plan changes only once the payment succeeds
// (webhook), so abandoning the checkout changes nothing.
export const POST = route(async ({ request, org, audit }) => {
  const { plan, interval = 'monthly' } = await readJson(request)
  if (!PAID_PLAN_IDS.includes(plan)) throw new ApiError(400, 'Choose a plan.')
  if (!INTERVALS.includes(interval)) throw new ApiError(400, 'Choose monthly or yearly billing.')

  const provider = billingProvider(request)
  if (!provider) throw new ApiError(503, 'Online payments are not set up yet. Please contact PGBook support to subscribe.')

  const state = billingState(org)
  if (['active', 'past_due'].includes(state.status) && org.plan === plan && org.billing?.interval === interval) {
    throw new ApiError(409, `You are already on ${PLANS[plan].label} (${interval}).`)
  }
  if (state.status === 'cancelling' && org.plan === plan) {
    throw new ApiError(409, 'This plan stays active until the end of the period. You can subscribe again once it ends, or pick a different plan now.')
  }
  const blocker = planBlocker(plan, await usageFor(org._id))
  if (blocker) throw new ApiError(409, `${blocker} Choose a bigger plan or reduce usage first.`)

  const sub = await createSubscription(provider, { orgId: org._id, plan, interval })
  org.billing.pending = { subscriptionId: sub.id, plan, interval, provider, createdAt: new Date() }
  await org.save()
  await audit('billing.checkout_started', { details: { plan, interval, provider } })
  return json({ checkoutUrl: sub.checkoutUrl, provider })
}, { permission: 'billing.manage', readOnlyOk: true })
