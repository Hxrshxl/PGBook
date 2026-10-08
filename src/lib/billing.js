import mongoose from 'mongoose'
import Payment from './models/Payment.js'
import Tenant from './models/Tenant.js'
import Property from './models/Property.js'
import UtilityBill from './models/UtilityBill.js'
import { calcLateFee, calcPaymentStatus, chargesTotal, getTotalDue, isBillableMonth, roundMoney } from '../utils/helpers.js'

const recurringFrom = tenant => (tenant.recurringCharges ?? []).map(c => ({ label: c.label, amount: c.amount }))

/**
 * Returns the dues record for a tenant + month, creating it (with the tenant's
 * current rent and recurring charges) if it does not exist yet. Safe to call concurrently.
 */
export async function ensureDue(orgId, tenant, month) {
  const filter = { userId: orgId, tenantId: tenant._id, month }
  const extraCharges = recurringFrom(tenant)
  const insert = {
    propertyId: tenant.propertyId ?? null,
    rentAmount: tenant.rentAmount,
    utilityShare: 0,
    extraCharges,
    lateFee: 0,
    amountPaid: 0,
    status: calcPaymentStatus(0, tenant.rentAmount + chargesTotal(extraCharges)),
  }
  try {
    return await Payment.findOneAndUpdate(filter, { $setOnInsert: insert }, { upsert: true, new: true, runValidators: true })
  } catch (err) {
    // Two concurrent upserts can race on the unique index; the loser just reads.
    if (err?.code === 11000) return Payment.findOne(filter)
    throw err
  }
}

/** Creates missing dues for every active tenant (within `tenantFilter`) who should be billed for `month`. */
export async function generateDues(orgId, month, tenantFilter = {}) {
  const tenants = await Tenant.find({ userId: orgId, status: 'active', ...tenantFilter })
  const billable = tenants.filter(t => isBillableMonth(t.moveInDate, month))
  const existing = await Payment.find({ userId: orgId, month, tenantId: { $in: billable.map(t => t._id) } }).select('tenantId')
  const have = new Set(existing.map(p => p.tenantId.toString()))
  const created = []
  for (const tenant of billable) {
    if (have.has(tenant._id.toString())) continue
    created.push(await ensureDue(orgId, tenant, month))
  }
  return created
}

/**
 * Recomputes utilityShare for the given tenants' dues in `month` from the
 * allocations stored on that month's bills. Returns the updated payments.
 */
export async function recomputeUtilityShares(orgId, month, tenantIds) {
  if (!tenantIds.length) return []
  const ids = tenantIds.map(id => new mongoose.Types.ObjectId(String(id)))
  const totals = await UtilityBill.aggregate([
    { $match: { userId: new mongoose.Types.ObjectId(String(orgId)), month } },
    { $unwind: '$allocations' },
    { $match: { 'allocations.tenantId': { $in: ids } } },
    { $group: { _id: '$allocations.tenantId', total: { $sum: '$allocations.amount' } } },
  ])
  const shareByTenant = new Map(totals.map(t => [t._id.toString(), roundMoney(t.total)]))

  const payments = await Payment.find({ userId: orgId, month, tenantId: { $in: ids } })
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

/**
 * Applies each property's late-fee rule to `month`'s unpaid dues (within `paymentFilter`).
 * Idempotent: re-running recalculates the fee (it grows daily for per-day rules) and never
 * charges a fee on a due that is fully paid excluding the fee. Returns the changed payments.
 */
export async function applyLateFees(orgId, month, today, paymentFilter = {}) {
  const payments = await Payment.find({ userId: orgId, month, ...paymentFilter })
  const properties = new Map((await Property.find({ orgId })).map(p => [p._id.toString(), p]))
  const changed = []
  for (const payment of payments) {
    const property = properties.get(String(payment.propertyId))
    if (!property) continue
    const withoutFee = getTotalDue({ ...payment.toObject(), lateFee: 0 })
    const unpaid = roundMoney(withoutFee - (payment.amountPaid ?? 0))
    const fee = calcLateFee(property.lateFee, { month, dueDay: property.rentDueDay, today, unpaid })
    // Only ever raise a fee automatically; reductions (waivers) are a deliberate, audited adjustment.
    if (fee > (payment.lateFee ?? 0)) {
      payment.lateFee = fee
      await payment.save()
      changed.push(payment)
    }
  }
  return changed
}

/** Updates this and future months' dues that have no payments yet after a tenant's rent or charges change. */
export async function syncOpenDues(orgId, tenant, fromMonth) {
  const open = await Payment.find({
    userId: orgId,
    tenantId: tenant._id,
    month: { $gte: fromMonth },
    'transactions.0': { $exists: false },
    amountPaid: 0,
  })
  const extraCharges = recurringFrom(tenant)
  const updated = []
  for (const payment of open) {
    const sameCharges = JSON.stringify(payment.extraCharges.map(c => ({ label: c.label, amount: c.amount }))) === JSON.stringify(extraCharges)
    if (payment.rentAmount === tenant.rentAmount && sameCharges) continue
    payment.rentAmount = tenant.rentAmount
    payment.extraCharges = extraCharges
    await payment.save()
    updated.push(payment)
  }
  return updated
}
