import mongoose from 'mongoose'
import User from '@/lib/models/User'
import Tenant from '@/lib/models/Tenant'
import Payment from '@/lib/models/Payment'
import Complaint from '@/lib/models/Complaint'
import AuditEvent from '@/lib/models/AuditEvent'
import ApprovalRequest from '@/lib/models/ApprovalRequest'
import { json } from '@/lib/api'
import { adminRoute } from '@/lib/adminApi'
import { can } from '@/lib/policy'
import { redactForAdmin } from '@/lib/audit'
import { ADMIN_REALM, approvalView, expireStaleApprovals } from '@/lib/approvals'
import { PLANS, PAID_PLAN_IDS, TRIAL_DAYS } from '@/lib/plans'
import { getCurrentMonth } from '@/utils/helpers'
import { OWNER_ONLY, propertyFacts } from '@/lib/orgStats'
import pkg from '../../../../../package.json'

const DAY = 86400000
// Platform money totals are shown only when at least this many owners contribute,
// so no single owner's revenue can be inferred from the dashboard.
const MIN_ORGS_FOR_TOTALS = 10
const NOISY_ACTIONS = ['admin.step_up', 'auth.login', 'admin.login']

const trialEndExpr = { $ifNull: ['$trialEndsAt', { $add: ['$createdAt', TRIAL_DAYS * DAY] }] }

export const GET = adminRoute(async ({ actor }) => {
  const now = new Date()
  const d7 = new Date(now - 7 * DAY)
  const d30 = new Date(now - 30 * DAY)
  const in3 = new Date(now.getTime() + 3 * DAY)
  const month = getCurrentMonth(process.env.APP_TIME_ZONE || 'Asia/Kolkata')
  const seeAccounts = can(actor, 'orgs.view')

  const [owners = {}] = await User.aggregate([
    { $match: OWNER_ONLY },
    { $addFields: { trialEnd: trialEndExpr } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        active30: { $sum: { $cond: [{ $gte: ['$lastActiveAt', d30] }, 1, 0] } },
        signups7: { $sum: { $cond: [{ $gte: ['$createdAt', d7] }, 1, 0] } },
        signups30: { $sum: { $cond: [{ $gte: ['$createdAt', d30] }, 1, 0] } },
        suspended: { $sum: { $cond: [{ $eq: ['$status', 'suspended'] }, 1, 0] } },
        onTrial: { $sum: { $cond: [{ $and: [{ $eq: ['$plan', 'trial'] }, { $gte: ['$trialEnd', now] }] }, 1, 0] } },
        trialExpired: { $sum: { $cond: [{ $and: [{ $eq: ['$plan', 'trial'] }, { $lt: ['$trialEnd', now] }] }, 1, 0] } },
        trialsEndingSoon: { $sum: { $cond: [{ $and: [{ $eq: ['$plan', 'trial'] }, { $gte: ['$trialEnd', now] }, { $lte: ['$trialEnd', in3] }] }, 1, 0] } },
        paid: { $sum: { $cond: [{ $in: ['$plan', PAID_PLAN_IDS] }, 1, 0] } },
        estMrr: {
          $sum: {
            $switch: {
              branches: PAID_PLAN_IDS.map(id => ({ case: { $eq: ['$plan', id] }, then: PLANS[id].monthlyPrice })),
              default: 0,
            },
          },
        },
      },
    },
  ])

  // Occupancy: active tenants vs beds (room capacities, or a property's manual bed count).
  const [facts, activeByOrg, activeTenants, openComplaints] = await Promise.all([
    propertyFacts(null),
    Tenant.aggregate([{ $match: { status: 'active' } }, { $group: { _id: '$userId', n: { $sum: 1 } } }]),
    Tenant.countDocuments({ status: 'active' }),
    Complaint.countDocuments({ status: { $ne: 'resolved' } }),
  ])
  const activeMap = new Map(activeByOrg.map(r => [r._id.toString(), r.n]))
  let occupiedBeds = 0
  let configuredBeds = 0
  for (const [orgId, f] of facts) {
    if (!f.beds) continue
    configuredBeds += f.beds
    occupiedBeds += Math.min(f.beds, activeMap.get(orgId) ?? 0)
  }

  // Payments recorded this month (rent goes owner-direct; this is what owners logged in PGBook).
  const paymentsByOrg = await Payment.aggregate([
    { $unwind: '$transactions' },
    { $match: { 'transactions.date': { $gte: `${month}-01`, $lte: `${month}-31` } } },
    { $group: { _id: '$userId', count: { $sum: 1 }, volume: { $sum: '$transactions.amount' } } },
  ])
  const paymentOrgs = paymentsByOrg.length
  const paymentsCount = paymentsByOrg.reduce((s, r) => s + r.count, 0)
  const paymentsVolume = paymentOrgs >= MIN_ORGS_FOR_TOTALS ? Math.round(paymentsByOrg.reduce((s, r) => s + r.volume, 0)) : null

  // Weekly signups, last 12 weeks
  const start = new Date(now.getTime() - 12 * 7 * DAY)
  const weekly = await User.aggregate([
    { $match: { createdAt: { $gte: start }, ...OWNER_ONLY } },
    { $group: { _id: { $floor: { $divide: [{ $subtract: ['$createdAt', start] }, 7 * DAY] } }, n: { $sum: 1 } } },
  ])
  const signupsByWeek = Array.from({ length: 12 }, (_, i) => ({
    weekStart: new Date(start.getTime() + i * 7 * DAY).toISOString().slice(0, 10),
    count: weekly.find(w => w._id === i)?.n ?? 0,
  }))

  // Needs attention
  await expireStaleApprovals()
  const pending = await ApprovalRequest.find({ status: 'pending', ...ADMIN_REALM }).sort({ createdAt: 1 })
  const waitingOnMe = pending.map(a => approvalView(a, actor)).filter(a => a.canDecide)
  const day1 = new Date(now - DAY)
  const [failedOwnerLogins, failedAdminLogins, payoutChanges] = await Promise.all([
    AuditEvent.countDocuments({ action: 'auth.login_failed', createdAt: { $gte: day1 } }),
    AuditEvent.countDocuments({ action: { $in: ['admin.login_failed', 'admin.locked'] }, createdAt: { $gte: day1 } }),
    AuditEvent.countDocuments({ action: 'settings.payout_upi_changed', createdAt: { $gte: d7 } }),
  ])

  let trialsEnding = []
  let suspendedOwners = []
  let activity = []
  if (seeAccounts) {
    trialsEnding = await User.aggregate([
      { $addFields: { trialEnd: trialEndExpr } },
      { $match: { ...OWNER_ONLY, plan: 'trial', status: 'active', trialEnd: { $gte: now, $lte: in3 } } },
      { $sort: { trialEnd: 1 } },
      { $limit: 5 },
      { $project: { name: 1, email: 1, trialEnd: 1 } },
    ])
    const trialFacts = await propertyFacts(trialsEnding.map(t => t._id))
    for (const t of trialsEnding) t.pgName = trialFacts.get(t._id.toString())?.firstProperty.name ?? ''
    suspendedOwners = await User.find({ ...OWNER_ONLY, status: 'suspended' }).sort({ 'suspension.at': -1 }).limit(5).select('name email suspension').lean()
    const suspendedFacts = await propertyFacts(suspendedOwners.map(u => u._id))
    for (const u of suspendedOwners) u.pgName = suspendedFacts.get(u._id.toString())?.firstProperty.name ?? ''
    activity = (await AuditEvent.find({ action: { $nin: NOISY_ACTIONS } }).sort({ createdAt: -1 }).limit(12)).map(redactForAdmin)
  }

  const pingStart = Date.now()
  await mongoose.connection.db.admin().ping()
  const dbLatencyMs = Date.now() - pingStart

  return json({
    owners: {
      total: owners.total ?? 0,
      active30: owners.active30 ?? 0,
      signups7: owners.signups7 ?? 0,
      signups30: owners.signups30 ?? 0,
      suspended: owners.suspended ?? 0,
      onTrial: owners.onTrial ?? 0,
      trialExpired: owners.trialExpired ?? 0,
      trialsEndingSoon: owners.trialsEndingSoon ?? 0,
      paid: owners.paid ?? 0,
      estMrr: owners.estMrr ?? 0,
    },
    usage: {
      activeTenants,
      beds: [...facts.values()].reduce((s, f) => s + f.beds, 0),
      occupancy: configuredBeds ? Math.round((occupiedBeds / configuredBeds) * 100) : null,
      paymentsCount,
      paymentsVolume,
      paymentOrgs,
      minOrgsForTotals: MIN_ORGS_FOR_TOTALS,
      openComplaints,
      month,
    },
    signupsByWeek,
    attention: {
      approvalsWaiting: waitingOnMe.length,
      approvals: waitingOnMe.slice(0, 5),
      failedOwnerLogins,
      failedAdminLogins,
      payoutChanges,
      trialsEnding: trialsEnding.map(t => ({ id: t._id.toString(), name: t.name, email: t.email, pgName: t.pgName, trialEnd: t.trialEnd })),
      suspended: suspendedOwners.map(u => ({ id: u._id.toString(), name: u.name, pgName: u.pgName, suspension: u.suspension })),
    },
    activity,
    health: {
      dbLatencyMs,
      version: pkg.version,
      environment: process.env.NODE_ENV,
      node: process.version,
      uptimeMinutes: Math.round(process.uptime() / 60),
    },
  })
}, { permission: 'platform.view' })
