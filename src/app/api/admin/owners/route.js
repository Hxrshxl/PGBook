import User from '@/lib/models/User'
import Tenant from '@/lib/models/Tenant'
import { json } from '@/lib/api'
import { adminRoute } from '@/lib/adminApi'
import { PLANS, PAID_PLAN_IDS, TRIAL_DAYS } from '@/lib/plans'
import Property from '@/lib/models/Property'
import { OWNER_ONLY, propertyFacts } from '@/lib/orgStats'

const DAY = 86400000
const PAGE_SIZE = 20
const trialEndExpr = { $ifNull: ['$trialEndsAt', { $add: ['$createdAt', TRIAL_DAYS * DAY] }] }
const escapeRegex = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const SORTS = {
  newest: { createdAt: -1 },
  active: { lastActiveAt: -1, createdAt: -1 },
  name: { name: 1 },
  oldest: { createdAt: 1 },
}

export const GET = adminRoute(async ({ request }) => {
  const params = new URL(request.url).searchParams
  const q = params.get('q')?.trim()
  const status = params.get('status')
  const plan = params.get('plan')
  const trial = params.get('trial')
  const sort = SORTS[params.get('sort')] ?? SORTS.newest
  const page = Math.max(1, Number(params.get('page')) || 1)

  const filter = { ...OWNER_ONLY }
  if (q) {
    const re = new RegExp(escapeRegex(q.slice(0, 100)), 'i')
    const byProperty = await Property.distinct('orgId', { name: re })
    filter.$or = [{ name: re }, { email: re }, { _id: { $in: byProperty } }]
  }
  if (status === 'active' || status === 'suspended') filter.status = status
  if (plan === 'paid') filter.plan = { $in: PAID_PLAN_IDS }
  else if (PLANS[plan]) filter.plan = plan

  const now = new Date()
  if (trial === 'ending') {
    filter.plan = 'trial'
    filter.$expr = { $and: [{ $gte: [trialEndExpr, now] }, { $lte: [trialEndExpr, new Date(now.getTime() + 3 * DAY)] }] }
  } else if (trial === 'expired') {
    filter.plan = 'trial'
    filter.$expr = { $lt: [trialEndExpr, now] }
  }

  const [total, users] = await Promise.all([
    User.countDocuments(filter),
    User.find(filter).sort(sort).skip((page - 1) * PAGE_SIZE).limit(PAGE_SIZE)
      .select('name email plan status trialEndsAt createdAt lastActiveAt'),
  ])
  const facts = await propertyFacts(users.map(u => u._id))

  const counts = await Tenant.aggregate([
    { $match: { userId: { $in: users.map(u => u._id) } } },
    { $group: { _id: '$userId', active: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } }, total: { $sum: 1 } } },
  ])
  const countMap = new Map(counts.map(c => [c._id.toString(), c]))

  return json({
    page,
    pageSize: PAGE_SIZE,
    total,
    owners: users.map(u => ({
      id: u._id.toString(),
      name: u.name,
      email: u.email,
      pgName: facts.get(u._id.toString())?.firstProperty.name ?? '',
      properties: facts.get(u._id.toString())?.propertyCount ?? 0,
      plan: u.plan,
      planLabel: PLANS[u.plan]?.label ?? u.plan,
      status: u.status ?? 'active',
      trialEndsAt: u.plan === 'trial' ? u.effectiveTrialEnd() : null,
      createdAt: u.createdAt,
      lastActiveAt: u.lastActiveAt,
      activeTenants: countMap.get(u._id.toString())?.active ?? 0,
      totalTenants: countMap.get(u._id.toString())?.total ?? 0,
      beds: facts.get(u._id.toString())?.beds ?? 0,
    })),
  })
}, { permission: 'orgs.view' })
