import mongoose from 'mongoose'
import UtilityBill from '@/lib/models/UtilityBill'
import Tenant from '@/lib/models/Tenant'
import { route, readJson, json, ApiError } from '@/lib/api'
import { ensureDue, recomputeUtilityShares } from '@/lib/billing'
import { billTarget } from '@/lib/auditTargets'
import { isBillableMonth, isValidMonth, roundMoney, splitAmount } from '@/utils/helpers'

export const GET = route(async ({ scope }) => {
  const bills = await UtilityBill.find(scope.filter()).sort({ month: -1, createdAt: -1 })
  return json(bills)
}, { permission: 'bills.view' })

// Splits a bill equally between tenants and adds each share to their dues for that month.
// tenantIds defaults to every active tenant living there that month.
export const POST = route(async ({ request, org, scope, audit }) => {
  const { month, type, totalAmount, tenantIds, note, propertyId } = await readJson(request)
  if (!isValidMonth(month)) throw new ApiError(400, 'Month must be YYYY-MM.')
  const total = roundMoney(totalAmount)
  if (!(total > 0)) throw new ApiError(400, 'Bill amount must be greater than zero.')
  const property = await scope.defaultProperty(propertyId)
  const inProperty = { userId: org._id, propertyId: property._id }

  let tenants
  if (Array.isArray(tenantIds) && tenantIds.length > 0) {
    if (!tenantIds.every(id => mongoose.isValidObjectId(id))) throw new ApiError(400, 'Invalid tenant selection.')
    tenants = await Tenant.find({ ...inProperty, _id: { $in: tenantIds } }).sort({ createdAt: 1 })
    if (tenants.length !== new Set(tenantIds.map(String)).size) throw new ApiError(400, `Some selected tenants are not in ${property.name}.`)
  } else {
    tenants = (await Tenant.find({ ...inProperty, status: 'active' }).sort({ createdAt: 1 }))
      .filter(t => isBillableMonth(t.moveInDate, month))
  }
  if (tenants.length === 0) throw new ApiError(400, 'There are no tenants to split this bill between.')

  const shares = splitAmount(total, tenants.length)
  const bill = await UtilityBill.create({
    userId: org._id,
    propertyId: property._id,
    month,
    type,
    totalAmount: total,
    perTenantAmount: shares[0],
    tenantCount: tenants.length,
    note: typeof note === 'string' ? note : '',
    allocations: tenants.map((t, i) => ({ tenantId: t._id, amount: shares[i] })),
  })

  // Make sure every charged tenant has a dues record for the month, then recompute shares.
  const dues = []
  for (const tenant of tenants) dues.push(await ensureDue(org._id, tenant, month))
  const recomputed = await recomputeUtilityShares(org._id, month, tenants.map(t => t._id))
  const byId = new Map(dues.map(p => [p._id.toString(), p]))
  for (const p of recomputed) byId.set(p._id.toString(), p)

  await audit('bill.create', { target: billTarget(bill), details: { type: bill.type, amount: bill.totalAmount, month, tenantCount: bill.tenantCount } })
  return json({ bill, payments: [...byId.values()] }, 201)
}, { permission: 'bills.manage' })
