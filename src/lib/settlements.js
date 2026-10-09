// Deposit settlement maths and the close-out, shared by the routes.
//   refund = deposit − unpaid dues − deductions   (negative → the tenant still owes that much)
// On close, unpaid dues are paid from the deposit on the ledger ("Adjusted from security deposit").
import Payment from './models/Payment.js'
import Tenant from './models/Tenant.js'
import { ApiError } from './api.js'
import { getBalance, roundMoney } from '../utils/helpers.js'

export async function unpaidDuesFor(orgId, tenantId) {
  const payments = await Payment.find({ userId: orgId, tenantId }).sort({ month: 1 })
  return payments.filter(p => getBalance(p) > 0).map(p => ({ paymentId: p._id, month: p.month, amount: getBalance(p) }))
}

export function cleanDeductions(list) {
  if (!Array.isArray(list)) return []
  return list
    .filter(d => d && String(d.label ?? '').trim())
    .map(d => {
      const amount = roundMoney(d.amount)
      if (!(amount >= 0)) throw new ApiError(400, 'Deduction amounts cannot be negative.')
      return { label: String(d.label).trim().slice(0, 80), amount }
    })
}

export function computeRefund(deposit, dues, deductions) {
  const owed = (dues ?? []).reduce((s, d) => s + d.amount, 0) + (deductions ?? []).reduce((s, d) => s + d.amount, 0)
  return roundMoney((deposit ?? 0) - owed)
}

/** Refreshes the dues snapshot and refund of a settlement that is still being prepared. */
export async function refreshSettlement(s) {
  s.unpaidDues = await unpaidDuesFor(s.orgId, s.tenantId)
  s.refundAmount = computeRefund(s.deposit, s.unpaidDues, s.deductions)
  return s
}

/**
 * Closes a settlement: records the refund, settles unpaid dues from the deposit on the
 * ledger, and marks the tenant as moved out. Refuses if the dues changed since the
 * settlement was shared (the tenant must see the final numbers).
 */
export async function closeSettlement(s, { method, reference, date, amount, actor }) {
  const current = await unpaidDuesFor(s.orgId, s.tenantId)
  const agreed = roundMoney(s.unpaidDues.reduce((t, d) => t + d.amount, 0))
  const now = roundMoney(current.reduce((t, d) => t + d.amount, 0))
  if (Math.abs(agreed - now) > 1) {
    throw new ApiError(409, `Unpaid dues changed since this settlement was shared (₹${agreed.toLocaleString('en-IN')} → ₹${now.toLocaleString('en-IN')}). Edit it and share it again.`)
  }
  const refund = roundMoney(amount ?? Math.max(0, s.refundAmount))
  if (refund < 0) throw new ApiError(400, 'Refund cannot be negative.')
  if (refund > 0 && !String(reference ?? '').trim() && method !== 'cash') throw new ApiError(400, 'Enter the UTR / reference of the refund.')

  // The deposit pays unpaid dues first.
  let remaining = s.deposit
  for (const due of current) {
    if (remaining <= 0) break
    const payment = await Payment.findById(due.paymentId)
    const pay = Math.min(getBalance(payment), remaining)
    if (pay <= 0) continue
    payment.transactions.push({ amount: roundMoney(pay), date, method: 'other', note: 'Adjusted from security deposit', recordedBy: actor, source: 'deposit' })
    await payment.save()
    remaining = roundMoney(remaining - pay)
  }

  const tenant = await Tenant.findById(s.tenantId)
  if (tenant && tenant.status === 'active') {
    tenant.status = 'vacated'
    tenant.moveOutDate = s.moveOutDate
    await tenant.save()
  }
  s.refund = { amount: refund, method, reference: String(reference ?? '').trim(), date, recordedBy: actor }
  s.status = 'closed'
  s.closedAt = new Date()
  await s.save()
  return s
}
