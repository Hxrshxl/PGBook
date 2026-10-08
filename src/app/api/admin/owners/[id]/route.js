import Tenant from '@/lib/models/Tenant'
import Payment from '@/lib/models/Payment'
import Complaint from '@/lib/models/Complaint'
import UtilityBill from '@/lib/models/UtilityBill'
import AuditEvent from '@/lib/models/AuditEvent'
import ApprovalRequest from '@/lib/models/ApprovalRequest'
import { json } from '@/lib/api'
import { adminRoute } from '@/lib/adminApi'
import { findOrg } from '@/lib/orgAdmin'
import { ADMIN_REALM, approvalView } from '@/lib/approvals'
import { can, maxTrialExtension } from '@/lib/policy'
import { PLANS } from '@/lib/plans'
import { propertyFacts, teamSize } from '@/lib/orgStats'
import { getCurrentMonth, todayISO } from '@/utils/helpers'

const DAY = 86400000

// Account details and usage COUNTS. No rupee amounts and no tenant details:
// that is the owner's business data (see docs/ROLES_AND_DASHBOARDS.md §6.2).
export const GET = adminRoute(async ({ params, actor }) => {
  const user = await findOrg(params.id)
  const tz = process.env.APP_TIME_ZONE || 'Asia/Kolkata'
  const month = getCurrentMonth(tz)
  const since30 = new Date(Date.now() - 30 * DAY)
  const since30Date = new Date(Date.now() - 30 * DAY).toISOString().slice(0, 10)

  const [tenantCounts, duesThisMonth, payments30, openComplaints, totalComplaints, bills, ownerEvents30, logins, pending] = await Promise.all([
    Tenant.aggregate([{ $match: { userId: user._id } }, { $group: { _id: '$status', n: { $sum: 1 } } }]),
    Payment.countDocuments({ userId: user._id, month }),
    Payment.aggregate([
      { $match: { userId: user._id } },
      { $unwind: '$transactions' },
      { $match: { 'transactions.date': { $gte: since30Date, $lte: todayISO(tz) } } },
      { $count: 'n' },
    ]),
    Complaint.countDocuments({ userId: user._id, status: { $ne: 'resolved' } }),
    Complaint.countDocuments({ userId: user._id }),
    UtilityBill.countDocuments({ userId: user._id }),
    AuditEvent.countDocuments({ orgId: user._id, 'actor.realm': 'org', createdAt: { $gte: since30 } }),
    AuditEvent.find({ orgId: user._id, action: { $in: ['auth.login', 'auth.login_failed', 'auth.login_blocked'] } })
      .sort({ createdAt: -1 }).limit(10),
    ApprovalRequest.find({ orgId: user._id, status: 'pending', ...ADMIN_REALM }).sort({ createdAt: -1 }),
  ])
  const byStatus = Object.fromEntries(tenantCounts.map(c => [c._id, c.n]))
  const facts = (await propertyFacts([user._id])).get(user._id.toString())
  const first = facts?.firstProperty
  const beds = facts?.beds ?? 0
  const staff = await teamSize(user._id)
  const active = byStatus.active ?? 0

  return json({
    owner: {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      phone: first?.phone ?? '',
      pgName: first?.name ?? '',
      address: first?.address ?? '',
      plan: user.plan,
      planLabel: PLANS[user.plan]?.label ?? user.plan,
      status: user.status ?? 'active',
      suspension: user.suspension ?? null,
      trialEndsAt: user.plan === 'trial' ? user.effectiveTrialEnd() : null,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
      lastActiveAt: user.lastActiveAt,
    },
    usage: {
      activeTenants: active,
      properties: facts?.propertyCount ?? 0,
      staff,
      vacatedTenants: byStatus.vacated ?? 0,
      beds,
      occupancy: beds ? Math.min(100, Math.round((active / beds) * 100)) : null,
      planTenantLimit: Number.isFinite(PLANS[user.plan]?.maxTenants) ? PLANS[user.plan].maxTenants : null,
      duesThisMonth,
      paymentsRecorded30: payments30[0]?.n ?? 0,
      openComplaints,
      totalComplaints,
      utilityBills: bills,
      ownerActions30: ownerEvents30,
    },
    logins: logins.map(e => ({ id: e._id.toString(), action: e.action, at: e.createdAt, ip: e.ip, userAgent: e.userAgent })),
    pendingApprovals: pending.map(a => approvalView(a, actor)),
    allowed: {
      extendTrialDays: maxTrialExtension(actor),
      forceLogout: can(actor, 'orgs.forceLogout'),
      suspend: can(actor, 'orgs.suspend') ? 'direct' : can(actor, 'orgs.requestSuspend') ? 'request' : null,
      reactivate: can(actor, 'orgs.reactivate') ? 'direct' : can(actor, 'orgs.requestReactivate') ? 'request' : null,
    },
  })
}, { permission: 'orgs.view' })
