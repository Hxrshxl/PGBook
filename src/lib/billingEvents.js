// Applies subscription events (from Razorpay webhooks, "Refresh status", or the
// local test checkout) to an organization. Every handler is safe to run twice.
import User from './models/User.js'
import { recordAudit, SYSTEM_ACTOR } from './audit.js'
import { issueInvoice } from './invoices.js'
import { cancelSubscription } from './billingProvider.js'
import { notifyOrg } from './notify.js'
import { PLANS, planPrice } from './plans.js'
import { formatCurrency } from '../utils/helpers.js'

const fmtDate = d => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })

export async function applyBillingEvent(event, { provider, now = new Date() }) {
  const { type, subscriptionId } = event
  if (!subscriptionId) return { ignored: 'no subscription' }
  const org = await User.findOne({ kind: { $ne: 'staff' }, $or: [{ 'billing.subscriptionId': subscriptionId }, { 'billing.pending.subscriptionId': subscriptionId }] })
  if (!org) return { ignored: 'unknown subscription' }

  const b = org.billing
  const isPending = b.pending?.subscriptionId === subscriptionId
  const isCurrent = b.subscriptionId === subscriptionId
  const target = { kind: 'subscription', id: subscriptionId, label: org.name }
  const audit = (action, details) => recordAudit({ actor: SYSTEM_ACTOR, action, orgId: org._id, target, details })

  switch (type) {
    case 'subscription.authenticated':
      return { ok: true } // mandate approved; the first charge follows

    case 'subscription.activated':
    case 'subscription.charged':
    case 'subscription.resumed': {
      let switched = false
      if (isPending && !isCurrent) {
        const previous = { id: b.subscriptionId, provider: b.provider, plan: org.plan }
        org.plan = b.pending.plan
        org.billing.interval = b.pending.interval
        org.billing.provider = b.pending.provider
        org.billing.subscriptionId = subscriptionId
        org.billing.pending = null
        switched = true
        // Changing plans replaces the old subscription, which stops right away.
        if (previous.id && previous.id !== subscriptionId) {
          await cancelSubscription(previous.provider, previous.id, { atCycleEnd: false }).catch(err => console.error('[billing] could not cancel old subscription', err))
        }
      } else if (!isCurrent) {
        return { ignored: 'not the current subscription' }
      }
      const wasPastDue = ['past_due', 'halted'].includes(b.status)
      org.billing.status = 'active'
      org.billing.pastDueSince = undefined
      org.billing.haltedAt = undefined
      org.billing.cancelAtPeriodEnd = false
      org.billing.cancelledAt = undefined
      if (event.periodStart) org.billing.currentPeriodStart = event.periodStart
      if (event.periodEnd) org.billing.currentPeriodEnd = event.periodEnd
      await org.save()

      let invoice = null
      if (type === 'subscription.charged' && event.payment?.amount > 0) {
        invoice = await issueInvoice(org, {
          plan: org.plan, interval: org.billing.interval, total: event.payment.amount,
          periodStart: event.periodStart, periodEnd: event.periodEnd,
          provider, providerPaymentId: event.payment.id, paidAt: now,
        })
      }
      const label = PLANS[org.plan]?.label ?? org.plan
      if (switched) {
        await audit('billing.subscribed', { plan: org.plan, interval: org.billing.interval })
        await notifyOrg({
          orgId: org._id, type: 'billing.subscribed', tone: 'success', email: true, key: `subscribed:${subscriptionId}`,
          title: `You're on the ${label} plan`, link: '/dashboard/billing',
          body: `Thank you! Your ${label} subscription (${formatCurrency(planPrice(org.plan, org.billing.interval))}/${org.billing.interval === 'yearly' ? 'year' : 'month'}, GST included) is active${org.billing.currentPeriodEnd ? ` until ${fmtDate(org.billing.currentPeriodEnd)}, then renews automatically` : ''}.`,
        })
      } else if (invoice) {
        await audit('billing.renewed', { plan: org.plan, invoice: invoice.number })
        await notifyOrg({
          orgId: org._id, type: 'billing.renewed', tone: 'success', email: wasPastDue, key: `charged:${event.payment.id}`,
          title: wasPastDue ? 'Payment received — your account is fully active again' : `Subscription renewed (${invoice.number})`,
          link: `/dashboard/billing/invoices/${invoice._id}`,
          body: `${formatCurrency(invoice.total)} received for ${label}. Invoice ${invoice.number} is ready to download.`,
        })
      }
      return { ok: true, switched, invoice: invoice?.number ?? null }
    }

    case 'subscription.pending': {
      if (!isCurrent) return { ignored: 'not the current subscription' }
      org.billing.status = 'past_due'
      org.billing.pastDueSince = org.billing.pastDueSince ?? now
      org.billing.lastFailureAt = now
      await org.save()
      await audit('billing.payment_failed', { plan: org.plan })
      await notifyOrg({
        orgId: org._id, type: 'billing.payment_failed', tone: 'warning', email: true,
        key: `past-due:${subscriptionId}:${now.toISOString().slice(0, 10)}`,
        title: 'Your PGBook payment failed', link: '/dashboard/billing',
        body: 'We could not charge your subscription. Razorpay will retry over the next few days; please make sure your payment method works. Your account stays fully usable for 14 days.',
      })
      return { ok: true }
    }

    case 'subscription.halted': {
      if (!isCurrent) return { ignored: 'not the current subscription' }
      org.billing.status = 'halted'
      org.billing.haltedAt = org.billing.haltedAt ?? now
      await org.save()
      await audit('billing.halted', { plan: org.plan })
      await notifyOrg({
        orgId: org._id, type: 'billing.halted', tone: 'danger', email: true, key: `halted:${subscriptionId}`,
        title: 'Your account is now read-only', link: '/dashboard/billing',
        body: 'All payment retries failed, so the subscription has stopped. You can still view and export everything. Choose a plan again to make changes.',
      })
      return { ok: true }
    }

    case 'subscription.cancelled':
    case 'subscription.completed': {
      if (isPending) {
        org.billing.pending = null
        await org.save()
        return { ok: true }
      }
      if (!isCurrent) return { ignored: 'not the current subscription' }
      if (org.billing.status === 'cancelled') return { ok: true }
      org.billing.status = 'cancelled'
      org.billing.cancelledAt = now
      if (event.periodEnd && !org.billing.currentPeriodEnd) org.billing.currentPeriodEnd = event.periodEnd
      await org.save()
      await audit('billing.cancelled', { plan: org.plan, endsAt: org.billing.currentPeriodEnd })
      return { ok: true }
    }

    default:
      return { ignored: `unhandled event ${type}` }
  }
}
