import crypto from 'node:crypto'
import { route, readJson, json, ApiError } from '@/lib/api'
import { billingProvider } from '@/lib/billingProvider'
import { applyBillingEvent } from '@/lib/billingEvents'
import { billingOverview } from '@/lib/billingView'
import { planPrice } from '@/lib/plans'
import User from '@/lib/models/User'

const DAY = 86400000
const addPeriod = (date, interval) => {
  const d = new Date(date)
  if (interval === 'yearly') d.setFullYear(d.getFullYear() + 1)
  else d.setMonth(d.getMonth() + 1)
  return d
}

// Local-development stand-in for Razorpay: simulates what the webhooks would say.
// Only available when billingProvider() is 'mock' (dev mode on localhost).
export const POST = route(async ({ request, org }) => {
  if (billingProvider(request) !== 'mock') throw new ApiError(404, 'Not found.')
  const { outcome } = await readJson(request)
  const b = org.billing ?? {}
  const now = new Date()
  const payment = amount => ({ id: `mock_pay_${crypto.randomBytes(8).toString('hex')}`, amount, status: 'captured' })

  if (outcome === 'pay') {
    if (!b.pending?.subscriptionId || b.pending.provider !== 'mock') throw new ApiError(409, 'There is no test checkout waiting.')
    await applyBillingEvent({
      type: 'subscription.charged', subscriptionId: b.pending.subscriptionId,
      periodStart: now, periodEnd: addPeriod(now, b.pending.interval), payment: payment(planPrice(b.pending.plan, b.pending.interval)),
    }, { provider: 'mock' })
  } else if (['renew', 'renewal_failed', 'halt'].includes(outcome)) {
    if (b.provider !== 'mock' || !b.subscriptionId) throw new ApiError(409, 'There is no test subscription.')
    const start = b.currentPeriodEnd && b.currentPeriodEnd > now ? b.currentPeriodEnd : now
    const event = outcome === 'renew'
      ? { type: 'subscription.charged', periodStart: start, periodEnd: addPeriod(start, b.interval), payment: payment(planPrice(org.plan, b.interval)) }
      : { type: outcome === 'halt' ? 'subscription.halted' : 'subscription.pending' }
    await applyBillingEvent({ ...event, subscriptionId: b.subscriptionId }, { provider: 'mock', now: new Date(now.getTime() + (outcome === 'halt' ? DAY : 0)) })
  } else if (outcome === 'abandon') {
    org.billing.pending = null
    await org.save()
  } else {
    throw new ApiError(400, 'Unknown test outcome.')
  }
  return json(await billingOverview(await User.findById(org._id), request))
}, { permission: 'billing.manage', readOnlyOk: true })
