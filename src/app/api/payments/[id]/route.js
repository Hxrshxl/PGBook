import CashCollection from '@/lib/models/CashCollection'
import { route, readJson, json, ApiError } from '@/lib/api'
import { findPayment } from '@/lib/paymentLookup'
import { paymentTarget } from '@/lib/auditTargets'
import { adjustDues, duesChanges, duesChangeSize } from '@/lib/duesOps'
import { approvalView, createApproval } from '@/lib/approvals'
import { can, LIMITS } from '@/lib/policy'

/**
 * Adjust a month's dues: rent (discount, pro-rating), late fee (waiver) or notes.
 *  • owner: always direct
 *  • manager: direct up to LIMITS.managerAdjustLimit, otherwise sent to the owner for approval
 *  • accountant: notes direct; money changes sent for approval
 * Approval requests need a reason and answer 202.
 */
export const PUT = route(async ({ request, params, org, scope, actor }) => {
  const payment = await findPayment(scope, params.id)
  const body = await readJson(request)
  const changes = duesChanges(body)
  const size = duesChangeSize(payment, changes)

  const direct = can(actor, 'rent.adjustAny')
    || (can(actor, 'rent.adjust') && size <= LIMITS.managerAdjustLimit)
    || (size === 0 && can(actor, 'rent.manage'))
  if (direct) {
    await adjustDues(payment, changes, { actor, request, orgId: org._id })
    return json(payment)
  }
  if (can(actor, 'rent.adjust') || can(actor, 'rent.requestAdjust')) {
    const approval = await createApproval({ type: 'org.dues.adjust', payload: { paymentId: params.id, changes }, reason: body.reason, actor, request })
    return json({ approval: approvalView(approval, actor), message: 'Sent to the owner for approval.' }, 202)
  }
  throw new ApiError(403, 'Your role cannot change dues.')
}, { permission: 'rent.view' })

// Removes a dues record created by mistake. Recorded payments must be removed first.
export const DELETE = route(async ({ params, scope, audit }) => {
  const payment = await findPayment(scope, params.id)
  if (payment.transactions.length > 0 || payment.amountPaid > 0) {
    throw new ApiError(409, 'This month has payments recorded. Remove those payments first.')
  }
  if (await CashCollection.exists({ paymentId: payment._id, status: 'pending' })) {
    throw new ApiError(409, 'Cash for this month is waiting for confirmation. Confirm or reject it in Approvals first.')
  }
  const target = await paymentTarget(payment)
  await payment.deleteOne()
  await audit('dues.delete', { target, details: { month: payment.month, rent: payment.rentAmount } })
  return json({ ok: true })
}, { permission: 'rent.manage' })
