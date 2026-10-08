import mongoose from 'mongoose'
import Payment from './models/Payment.js'
import Tenant from './models/Tenant.js'
import UtilityBill from './models/UtilityBill.js'
import { calcPaymentStatus, isBillableMonth, roundMoney } from '../utils/helpers.js'

/**
 * Returns the dues record for a tenant + month, creating it (with the
 * tenant's current rent) if it does not exist yet. Safe to call concurrently.
 */
export async function ensureDue(userId, tenant, month) {
  const filter = { userId, tenantId: tenant._id, month }
  const insert = {
    rentAmount: tenant.rentAmount,
    utilityShare: 0,
    amountPaid: 0,
    status: calcPaymentStatus(0, tenant.rentAmount),
  }
  try {
    return await Payment.findOneAndUpdate(filter, { $setOnInsert: insert }, { upsert: true, new: true, runValidators: true })
  } catch (err) {
    // Two concurrent upserts can race on the unique index; the loser just reads.
    if (err?.code === 11000) return Payment.findOne(filter)
    throw err
  }
}

/** Creates missing dues for every active tenant who should be billed for `month`. */
export async function generateDues(userId, month) {
  const tenants = await Tenant.find({ userId, status: 'active' })
  const billable = tenants.filter(t => isBillableMonth(t.moveInDate, month))
  const existing = await Payment.find({ userId, month, tenantId: { $in: billable.map(t => t._id) } }).select('tenantId')
  const have = new Set(existing.map(p => p.tenantId.toString()))
  const created = []
  for (const tenant of billable) {
    if (have.has(tenant._id.toString())) continue
    created.push(await ensureDue(userId, tenant, month))
  }
  return created
}

/**
 * Recomputes utilityShare for the given tenants' dues in `month` from the
 * allocations stored on that month's bills. Returns the updated payments.
 */
export async function recomputeUtilityShares(userId, month, tenantIds) {
  if (!tenantIds.length) return []
  const ids = tenantIds.map(id => new mongoose.Types.ObjectId(String(id)))
  const totals = await UtilityBill.aggregate([
    { $match: { userId: new mongoose.Types.ObjectId(String(userId)), month } },
    { $unwind: '$allocations' },
    { $match: { 'allocations.tenantId': { $in: ids } } },
    { $group: { _id: '$allocations.tenantId', total: { $sum: '$allocations.amount' } } },
  ])
  const shareByTenant = new Map(totals.map(t => [t._id.toString(), roundMoney(t.total)]))

  const payments = await Payment.find({ userId, month, tenantId: { $in: ids } })
  const updated = []
  for (const payment of payments) {
    const share = shareByTenant.get(payment.tenantId.toString()) ?? 0
    if (payment.utilityShare !== share) {
      payment.utilityShare = share
      await payment.save() // pre-validate hook recalculates status
      updated.push(payment)
    }
  }
  return updated
}
