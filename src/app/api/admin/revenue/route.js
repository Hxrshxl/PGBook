import User from '@/lib/models/User'
import Invoice from '@/lib/models/Invoice'
import AuditEvent from '@/lib/models/AuditEvent'
import { json } from '@/lib/api'
import { adminRoute } from '@/lib/adminApi'
import { can } from '@/lib/policy'
import { monthlyValue, PAID_PLAN_IDS, PLANS } from '@/lib/plans'
import { billingState, STATUS_LABELS } from '@/lib/subscription'
import { OWNER_ONLY } from '@/lib/orgStats'

const DAY = 86400000

// PGBook's own revenue: subscriptions, MRR, failed payments, invoices.
// Owner names appear only for roles that can view accounts (not analysts).
export const GET = adminRoute(async ({ actor }) => {
  const now = new Date()
  const showAccounts = can(actor, 'orgs.view')
  const owners = await User.find({ ...OWNER_ONLY }).select('name email plan trialEndsAt createdAt billing status').lean()

  const byStatus = {}
  const byPlan = Object.fromEntries(PAID_PLAN_IDS.map(id => [id, { count: 0, mrr: 0 }]))
  const attention = { pastDue: [], cancelling: [], readOnly: [], trialsEnding: [] }
  let mrr = 0
  for (const o of owners) {
    const s = billingState(o, now)
    byStatus[s.status] = (byStatus[s.status] ?? 0) + 1
    const paying = ['active', 'past_due', 'cancelling'].includes(s.status) && PAID_PLAN_IDS.includes(s.plan) && o.billing?.provider !== 'manual' && o.billing?.status
    if (paying) {
      const value = monthlyValue(s.plan, o.billing?.interval ?? 'monthly')
      mrr += value
      byPlan[s.plan].count += 1
      byPlan[s.plan].mrr += value
    }
    const row = { id: o._id.toString(), name: o.name, email: o.email, plan: s.plan, status: s.status, statusLabel: STATUS_LABELS[s.status] }
    if (s.status === 'past_due') attention.pastDue.push({ ...row, since: s.pastDueSince, graceUntil: s.graceUntil })
    if (s.status === 'cancelling') attention.cancelling.push({ ...row, endsAt: o.billing?.currentPeriodEnd })
    if (s.readOnly) attention.readOnly.push({ ...row, since: s.readOnlySince, retentionUntil: s.retentionUntil })
    if (s.status === 'trialing' && s.daysLeft <= 3) attention.trialsEnding.push({ ...row, trialEndsAt: s.trialEndsAt })
  }

  const d30 = new Date(now - 30 * DAY)
  const [collected30] = await Invoice.aggregate([{ $match: { issuedAt: { $gte: d30 }, status: 'paid' } }, { $group: { _id: null, total: { $sum: '$total' }, gst: { $sum: { $add: ['$cgst', '$sgst', '$igst'] } }, n: { $sum: 1 } } }])
  const failed30 = await AuditEvent.countDocuments({ action: 'billing.payment_failed', createdAt: { $gte: d30 } })
  const recent = await Invoice.find().sort({ issuedAt: -1 }).limit(20).lean()
  const names = new Map(owners.map(o => [o._id.toString(), o.name]))

  const sortBy = (list, key) => list.sort((a, b) => new Date(a[key] ?? 0) - new Date(b[key] ?? 0)).slice(0, 20)
  return json({
    mrr: Math.round(mrr),
    arr: Math.round(mrr * 12),
    byPlan: PAID_PLAN_IDS.map(id => ({ id, label: PLANS[id].label, count: byPlan[id].count, mrr: Math.round(byPlan[id].mrr) })),
    byStatus: Object.entries(byStatus).map(([status, count]) => ({ status, label: STATUS_LABELS[status] ?? status, count })),
    last30: { collected: Math.round(collected30?.total ?? 0), gst: Math.round(collected30?.gst ?? 0), invoices: collected30?.n ?? 0, failedPayments: failed30 },
    attention: showAccounts ? {
      pastDue: sortBy(attention.pastDue, 'graceUntil'),
      cancelling: sortBy(attention.cancelling, 'endsAt'),
      readOnly: sortBy(attention.readOnly, 'retentionUntil'),
      trialsEnding: sortBy(attention.trialsEnding, 'trialEndsAt'),
    } : null,
    counts: { pastDue: attention.pastDue.length, cancelling: attention.cancelling.length, readOnly: attention.readOnly.length, trialsEnding: attention.trialsEnding.length },
    invoices: recent.map(i => ({
      id: i._id.toString(), number: i.number, issuedAt: i.issuedAt, total: i.total, plan: i.plan, interval: i.interval,
      owner: showAccounts ? names.get(String(i.orgId)) ?? '—' : undefined, orgId: showAccounts ? String(i.orgId) : undefined,
    })),
  })
}, { permission: 'revenue.view' })
