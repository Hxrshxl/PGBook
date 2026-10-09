// Subscription payments through Razorpay, or a test-mode stand-in for local development.
//
// Razorpay needs: RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET and one plan id per
// plan and interval, created in the Razorpay dashboard with the same price as src/lib/plans.js:
//   RAZORPAY_PLAN_STARTER_MONTHLY, RAZORPAY_PLAN_STARTER_YEARLY, RAZORPAY_PLAN_PRO_MONTHLY, …
// Webhook URL: https://<your-domain>/api/billing/webhook with the subscription.* events.
import crypto from 'node:crypto'
import { ApiError } from './api.js'
import { devFallbacksAllowed } from './devMode.js'

const apiBase = () => process.env.RAZORPAY_API_BASE || 'https://api.razorpay.com/v1'

export function razorpayConfigured() {
  return !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET)
}

/** 'razorpay', 'mock' (local development only) or null when billing isn't set up. */
export function billingProvider(request) {
  if (razorpayConfigured()) return 'razorpay'
  if (devFallbacksAllowed(request)) return 'mock'
  return null
}

export function razorpayPlanId(plan, interval) {
  return process.env[`RAZORPAY_PLAN_${plan.toUpperCase()}_${interval.toUpperCase()}`] || null
}

async function razorpay(method, path, body) {
  const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString('base64')
  let res
  try {
    res = await fetch(`${apiBase()}${path}`, {
      method,
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new ApiError(502, 'Could not reach the payment provider. Please try again.')
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    console.error('[razorpay]', method, path, res.status, data?.error)
    throw new ApiError(502, data?.error?.description ? `Payment provider: ${data.error.description}` : 'The payment provider returned an error.')
  }
  return data
}

/** Starts a subscription. Returns { id, checkoutUrl } — the owner pays on the provider's page. */
export async function createSubscription(provider, { orgId, plan, interval }) {
  if (provider === 'mock') {
    const id = `mock_sub_${crypto.randomBytes(8).toString('hex')}`
    return { id, checkoutUrl: `/dashboard/billing/checkout?subscription=${id}` }
  }
  const planId = razorpayPlanId(plan, interval)
  if (!planId) throw new ApiError(503, 'This plan is not available for online payment yet. Please contact support.')
  const sub = await razorpay('POST', '/subscriptions', {
    plan_id: planId,
    total_count: interval === 'yearly' ? 10 : 120,
    quantity: 1,
    customer_notify: 1,
    notes: { orgId: String(orgId), plan, interval },
  })
  return { id: sub.id, checkoutUrl: sub.short_url }
}

/** Cancels at the end of the current period (or right away). */
export async function cancelSubscription(provider, subscriptionId, { atCycleEnd = true } = {}) {
  if (provider !== 'razorpay' || !subscriptionId) return
  await razorpay('POST', `/subscriptions/${subscriptionId}/cancel`, { cancel_at_cycle_end: atCycleEnd ? 1 : 0 })
}

/** The provider's current view of a subscription, as a normalized event (used by "Refresh status"). */
export async function fetchSubscriptionEvent(provider, subscriptionId) {
  if (provider !== 'razorpay' || !subscriptionId) return null
  const sub = await razorpay('GET', `/subscriptions/${subscriptionId}`)
  const type = {
    active: 'subscription.activated', pending: 'subscription.pending', halted: 'subscription.halted',
    cancelled: 'subscription.cancelled', completed: 'subscription.completed',
  }[sub.status]
  return type ? normalizeSubscription(type, sub, null) : null
}

// ── Webhooks ──────────────────────────────────────────────────

export function verifyWebhookSignature(rawBody, signature) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET
  if (!secret || !signature) return false
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex')
  const a = Buffer.from(expected)
  const b = Buffer.from(String(signature))
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

function normalizeSubscription(type, sub, payment) {
  return {
    type,
    subscriptionId: sub?.id ?? null,
    orgId: sub?.notes?.orgId ?? null,
    plan: sub?.notes?.plan ?? null,
    interval: sub?.notes?.interval ?? null,
    periodStart: sub?.current_start ? new Date(sub.current_start * 1000) : null,
    periodEnd: sub?.current_end ? new Date(sub.current_end * 1000) : null,
    payment: payment ? { id: payment.id, amount: Math.round(payment.amount) / 100, status: payment.status } : null,
  }
}

/** Turns a Razorpay webhook body into { type, subscriptionId, orgId, plan, interval, periodStart, periodEnd, payment }. */
export function parseRazorpayEvent(body) {
  return normalizeSubscription(body?.event, body?.payload?.subscription?.entity, body?.payload?.payment?.entity)
}
