// An organization's subscription state, derived from its plan, trial end and
// what the billing provider last told us. Pure functions: no database access,
// so the same rules run in the API, the cron job and the unit tests.
//
//   trialing ──(trial ends)──▶ trial_expired ─┐
//   active ──(renewal fails)──▶ past_due ──(14 days or retries exhausted)──▶ unpaid ─┤  read-only:
//   active ──(cancel)──▶ cancelling ──(period ends)──▶ ended ────────────────────────┘  view + export
//
// Read-only accounts keep all their data for RETENTION_DAYS (§9.1 of the design doc).
import { PLANS, TRIAL_DAYS, planPrice } from './plans.js'

export const GRACE_DAYS = 14
export const RETENTION_DAYS = 90
const DAY = 86400000

export const STATUS_LABELS = {
  trialing: 'Free trial',
  trial_expired: 'Trial ended',
  active: 'Active',
  cancelling: 'Cancels at period end',
  past_due: 'Payment failed',
  unpaid: 'Unpaid — read-only',
  ended: 'Subscription ended',
}

export function trialEnd(org) {
  if (org.trialEndsAt) return new Date(org.trialEndsAt)
  const created = org.createdAt ? new Date(org.createdAt).getTime() : Date.now()
  return new Date(created + TRIAL_DAYS * DAY)
}

const daysUntil = (date, now) => Math.ceil((new Date(date).getTime() - now.getTime()) / DAY)

/**
 * { status, readOnly, plan, interval, trialEndsAt, daysLeft, currentPeriodEnd, graceUntil,
 *   readOnlySince, retentionUntil, cancelAtPeriodEnd, provider }
 */
export function billingState(org, now = new Date()) {
  const plan = PLANS[org.plan] ? org.plan : 'trial'
  const b = org.billing ?? {}
  const base = {
    plan,
    planLabel: PLANS[plan].label,
    interval: b.interval ?? null,
    provider: b.provider ?? null,
    currentPeriodEnd: b.currentPeriodEnd ?? null,
    cancelAtPeriodEnd: !!b.cancelAtPeriodEnd,
    price: plan === 'trial' ? 0 : planPrice(plan, b.interval ?? 'monthly'),
  }
  const readOnlyFrom = since => ({
    readOnly: true,
    readOnlySince: since,
    retentionUntil: new Date(new Date(since).getTime() + RETENTION_DAYS * DAY),
  })

  if (plan === 'trial') {
    const end = trialEnd(org)
    if (now < end) return { ...base, status: 'trialing', readOnly: false, trialEndsAt: end, daysLeft: daysUntil(end, now) }
    return { ...base, status: 'trial_expired', trialEndsAt: end, ...readOnlyFrom(end) }
  }

  // Paid plan. No billing record = granted by PGBook (or an account from before billing).
  const periodEnd = b.currentPeriodEnd ? new Date(b.currentPeriodEnd) : null
  switch (b.status ?? 'active') {
    case 'past_due': {
      const since = b.pastDueSince ? new Date(b.pastDueSince) : now
      const graceUntil = new Date(since.getTime() + GRACE_DAYS * DAY)
      if (now < graceUntil) return { ...base, status: 'past_due', readOnly: false, pastDueSince: since, graceUntil, daysLeft: daysUntil(graceUntil, now) }
      return { ...base, status: 'unpaid', pastDueSince: since, graceUntil, ...readOnlyFrom(graceUntil) }
    }
    case 'halted':
      return { ...base, status: 'unpaid', ...readOnlyFrom(b.haltedAt ?? now) }
    case 'cancelled':
      if (periodEnd && now < periodEnd) return { ...base, status: 'cancelling', readOnly: false, daysLeft: daysUntil(periodEnd, now) }
      return { ...base, status: 'ended', ...readOnlyFrom(periodEnd ?? b.cancelledAt ?? now) }
    default:
      // Active. A cancellation scheduled for the end of the period (or a grant with an end date)
      // keeps full access until then.
      if (b.cancelAtPeriodEnd && periodEnd) {
        if (now < periodEnd) return { ...base, status: 'cancelling', readOnly: false, daysLeft: daysUntil(periodEnd, now) }
        return { ...base, status: 'ended', ...readOnlyFrom(periodEnd) }
      }
      return { ...base, status: 'active', readOnly: false }
  }
}

/** The limits that apply right now: the trial's, or the plan's. */
export function limitsFor(state) {
  const p = PLANS[state.plan] ?? PLANS.trial
  return { tenants: p.maxTenants, properties: p.maxProperties, staff: p.maxStaff }
}

/** Why a plan can't be chosen with the current usage, or null. */
export function planBlocker(plan, usage) {
  const p = PLANS[plan]
  if (!p) return 'Unknown plan.'
  if (usage.tenants > p.maxTenants) return `You have ${usage.tenants} active tenants; ${p.label} allows ${p.maxTenants}.`
  if (usage.properties > p.maxProperties) return `You have ${usage.properties} properties; ${p.label} allows ${p.maxProperties}.`
  if (usage.staff > p.maxStaff) {
    return p.maxStaff ? `You have ${usage.staff} staff logins; ${p.label} allows ${p.maxStaff}.` : `${p.label} has no staff logins — remove your ${usage.staff} team member(s) first.`
  }
  return null
}

/** Banner text for the dashboard, or null when everything is fine. */
export function billingNotice(state, { isOwner }) {
  const renew = isOwner ? 'Choose a plan in Subscription' : 'Ask the owner to renew the subscription'
  switch (state.status) {
    case 'trialing':
      return state.daysLeft <= 3 ? { tone: 'info', text: `Your free trial ends in ${state.daysLeft} day${state.daysLeft === 1 ? '' : 's'}. ${isOwner ? 'Choose a plan to keep going without interruption.' : ''}`.trim() } : null
    case 'past_due':
      return { tone: 'warning', text: `The last subscription payment failed. ${isOwner ? 'Update your payment' : 'Ask the owner to update the payment'} within ${state.daysLeft} day${state.daysLeft === 1 ? '' : 's'} to avoid read-only mode.` }
    case 'cancelling':
      return state.daysLeft <= 7 ? { tone: 'info', text: `The subscription ends in ${state.daysLeft} day${state.daysLeft === 1 ? '' : 's'}. After that the account becomes read-only.` } : null
    case 'trial_expired':
    case 'unpaid':
    case 'ended':
      return {
        tone: 'danger',
        text: `${state.status === 'trial_expired' ? 'Your free trial has ended' : state.status === 'unpaid' ? 'The subscription is unpaid' : 'The subscription has ended'}, so this account is read-only. ${renew} to make changes again — nothing has been deleted, and you can still view and export everything.`,
      }
    default:
      return null
  }
}

/** Capabilities that keep working in read-only mode (besides anything that only views). */
export const READ_ONLY_ALLOWED = ['billing.manage', 'data.export']
