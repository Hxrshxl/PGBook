// Daily housekeeping (run by /api/cron/daily). Every job is idempotent: reminders
// carry a key, so running twice in a day sends nothing new.
import User from './models/User.js'
import Tenant from './models/Tenant.js'
import Complaint from './models/Complaint.js'
import PaymentClaim from './models/PaymentClaim.js'
import { notifyOrg } from './notify.js'
import { billingState, RETENTION_DAYS } from './subscription.js'
import { toWhatsAppNumber } from '../utils/helpers.js'

const DAY = 86400000
const fmt = d => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })

/** Trial ending (3 days, 1 day), trial ended, payment overdue, read-only, data-retention countdown. */
export async function subscriptionReminders(now = new Date()) {
  let sent = 0
  const owners = User.find({ kind: { $ne: 'staff' }, status: 'active' }).select('name email plan trialEndsAt createdAt billing').cursor()
  for await (const org of owners) {
    const s = billingState(org, now)
    const send = async args => { if (await notifyOrg({ orgId: org._id, link: '/dashboard/billing', email: true, ...args })) sent++ }

    if (s.status === 'trialing' && s.daysLeft <= 3) {
      const when = s.daysLeft <= 1 ? 1 : 3
      await send({
        type: 'billing.trial_ending', key: `trial-ending:${org._id}:${when}:${new Date(s.trialEndsAt).toISOString().slice(0, 10)}`,
        title: `Your free trial ends ${when === 1 ? 'tomorrow' : `in ${s.daysLeft} days`}`,
        body: `Your trial ends on ${fmt(s.trialEndsAt)}. Choose a plan to keep adding tenants and recording payments without interruption.`,
      })
    }
    if (s.status === 'trial_expired' && now - new Date(s.trialEndsAt) < 7 * DAY) {
      await send({
        type: 'billing.trial_ended', tone: 'danger', key: `trial-ended:${org._id}:${new Date(s.trialEndsAt).toISOString().slice(0, 10)}`,
        title: 'Your free trial has ended — the account is read-only',
        body: `You can still view and export everything. Choose a plan to make changes again. Your data is kept until ${fmt(s.retentionUntil)}.`,
      })
    }
    if (s.status === 'past_due') {
      const day = Math.floor((now - new Date(s.pastDueSince)) / DAY)
      for (const mark of [1, 3, 7]) {
        if (day >= mark) {
          await send({
            type: 'billing.past_due', tone: 'warning', key: `past-due-reminder:${org._id}:${new Date(s.pastDueSince).toISOString().slice(0, 10)}:${mark}`,
            title: 'Your PGBook payment is still pending',
            body: `We couldn't collect your subscription payment. Update your payment method before ${fmt(s.graceUntil)} to avoid read-only mode.`,
          })
        }
      }
    }
    if (s.readOnly && s.retentionUntil) {
      const left = Math.ceil((new Date(s.retentionUntil) - now) / DAY)
      for (const mark of [30, 7, 1]) {
        if (left <= mark && left > 0) {
          await send({
            type: 'billing.retention', tone: 'danger', key: `retention:${org._id}:${new Date(s.readOnlySince).toISOString().slice(0, 10)}:${mark}`,
            title: `Your PGBook data is kept for ${left} more day${left === 1 ? '' : 's'}`,
            body: `Your account has been read-only since ${fmt(s.readOnlySince)}. After ${fmt(s.retentionUntil)} (${RETENTION_DAYS} days) it may be deleted. Choose a plan, or export your data from Subscription.`,
          })
          break
        }
      }
    }
  }
  return { sent }
}

/** Payment claims waiting more than 48 hours get a reminder to whoever reviews them. */
export async function claimReminders(now = new Date()) {
  const stale = await PaymentClaim.find({ status: 'pending', createdAt: { $lte: new Date(now - 2 * DAY) } }).limit(500)
  let sent = 0
  for (const c of stale) {
    if (await notifyOrg({
      orgId: c.orgId, capability: 'claims.review', type: 'claims.waiting', tone: 'warning', key: `claim-reminder:${c._id}`,
      title: `${c.tenantName} is waiting for you to confirm a payment`, link: '/dashboard/approvals',
      body: `₹${c.amount.toLocaleString('en-IN')} reported on ${c.date}${c.utr ? ` (UTR ${c.utr})` : ''}. Approve or reject it in Approvals.`,
    })) sent++
  }
  return { sent }
}

/** Tenant-raised complaints resolved 72 h ago without a reply are closed automatically. */
export async function autoCloseComplaints(now = new Date()) {
  const result = await Complaint.updateMany(
    { source: 'resident', status: 'resolved', closedAt: null, resolvedAt: { $lte: new Date(now - 3 * DAY) } },
    { $set: { closedAt: now, closedBy: 'auto' } },
  )
  return { closed: result.modifiedCount }
}

/** Login phone numbers for tenants created before the tenant app existed. */
export async function backfillPhoneKeys(limit = 5000) {
  const missing = await Tenant.find({ $or: [{ phoneKey: { $exists: false } }, { phoneKey: '' }] }).select('phone').limit(limit).lean()
  if (!missing.length) return { updated: 0 }
  await Tenant.bulkWrite(missing.map(t => ({ updateOne: { filter: { _id: t._id }, update: { $set: { phoneKey: toWhatsAppNumber(t.phone) } } } })))
  return { updated: missing.length }
}

export async function runDailyJobs(now = new Date()) {
  const results = {}
  for (const [name, job] of Object.entries({ subscriptionReminders, claimReminders, autoCloseComplaints, backfillPhoneKeys })) {
    try {
      results[name] = await job(now)
    } catch (err) {
      console.error(`[cron] ${name} failed`, err)
      results[name] = { error: err.message }
    }
  }
  return results
}
