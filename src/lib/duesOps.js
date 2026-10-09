// Money corrections on a month's dues. Used directly (owner, or a manager within
// their limit) and when an owner approves a staff member's request.
import mongoose from 'mongoose'
import Payment from './models/Payment.js'
import { ApiError, pick } from './api.js'
import { recordAudit } from './audit.js'
import { paymentTarget } from './auditTargets.js'
import { getTotalDue, roundMoney } from '../utils/helpers.js'

export async function orgPayment(orgId, paymentId) {
  if (!mongoose.isValidObjectId(paymentId)) throw new ApiError(404, 'Payment not found.')
  const payment = await Payment.findOne({ _id: paymentId, userId: orgId })
  if (!payment) throw new ApiError(404, 'Payment not found.')
  return payment
}

/** The fields of a due that may be changed: rent for the month, the late fee, notes. */
export function duesChanges(body) {
  const changes = pick(body ?? {}, ['rentAmount', 'lateFee', 'notes'])
  for (const key of ['rentAmount', 'lateFee']) {
    if (changes[key] === undefined) continue
    const n = Number(changes[key])
    if (!Number.isFinite(n) || n < 0) throw new ApiError(400, key === 'lateFee' ? 'Late fee cannot be negative.' : 'Rent cannot be negative.')
    changes[key] = roundMoney(n)
  }
  if (changes.notes !== undefined) changes.notes = String(changes.notes)
  return changes
}

/** How much the total due would move (₹, absolute). */
export function duesChangeSize(payment, changes) {
  const after = getTotalDue({ ...payment.toObject(), ...changes })
  return Math.abs(roundMoney(after - getTotalDue(payment)))
}

export async function adjustDues(payment, changes, { actor, request, orgId, approval }) {
  const before = { rent: payment.rentAmount, lateFee: payment.lateFee ?? 0, notes: payment.notes }
  payment.set(changes)
  if (getTotalDue(payment) < payment.amountPaid) {
    throw new ApiError(400, `Total due cannot be less than the ₹${payment.amountPaid.toLocaleString('en-IN')} already paid.`)
  }
  await payment.save()
  const changed = before.rent !== payment.rentAmount || before.lateFee !== (payment.lateFee ?? 0) || before.notes !== payment.notes
  if (changed) {
    await recordAudit({
      actor, action: 'dues.adjust', orgId, request,
      target: await paymentTarget(payment),
      reason: approval?.reason ?? '',
      details: {
        month: payment.month,
        rentFrom: before.rent, rentTo: payment.rentAmount,
        lateFeeFrom: before.lateFee, lateFeeTo: payment.lateFee ?? 0,
        notesChanged: before.notes !== payment.notes,
        ...(approval ? { approvalId: approval._id.toString(), requestedBy: approval.requestedBy.name } : {}),
      },
    })
  }
  return payment
}

export async function removePaymentEntry(payment, txId, { actor, request, orgId, approval }) {
  const tx = payment.transactions.id(txId)
  if (!tx) throw new ApiError(404, 'Payment entry not found — it may already have been removed.')
  const removed = { amount: tx.amount, method: tx.method, date: tx.date }
  tx.deleteOne()
  await payment.save()
  await recordAudit({
    actor, action: 'payment.remove', orgId, request,
    target: await paymentTarget(payment),
    reason: approval?.reason ?? '',
    details: { month: payment.month, ...removed, ...(approval ? { approvalId: approval._id.toString(), requestedBy: approval.requestedBy.name } : {}) },
  })
  return payment
}
