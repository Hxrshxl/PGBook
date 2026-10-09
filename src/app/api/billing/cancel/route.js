import { route, readJson, json, ApiError } from '@/lib/api'
import { cancelSubscription } from '@/lib/billingProvider'
import { billingOverview } from '@/lib/billingView'
import { billingState } from '@/lib/subscription'

// Cancels at the end of the paid period (L2: a reason is required).
// The account stays fully usable until then, then becomes read-only; data is kept 90 days.
export const POST = route(async ({ request, org, audit }) => {
  const { reason } = await readJson(request)
  if (typeof reason !== 'string' || reason.trim().length < 3) throw new ApiError(400, 'Please tell us why you are cancelling.')
  const state = billingState(org)
  if (!['active', 'past_due'].includes(state.status) || !org.billing?.subscriptionId) {
    throw new ApiError(409, org.billing?.provider === 'manual'
      ? 'Your plan was set up by PGBook. Please contact support to change it.'
      : 'There is no active subscription to cancel.')
  }
  await cancelSubscription(org.billing.provider, org.billing.subscriptionId, { atCycleEnd: true })
  org.billing.cancelAtPeriodEnd = true
  if (!org.billing.currentPeriodEnd) org.billing.currentPeriodEnd = new Date()
  await org.save()
  await audit('billing.cancel_requested', { reason: reason.trim(), details: { endsAt: org.billing.currentPeriodEnd } })
  return json(await billingOverview(org, request))
}, { permission: 'billing.manage', readOnlyOk: true })
