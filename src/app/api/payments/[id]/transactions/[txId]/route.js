import { route, json, ApiError } from '@/lib/api'
import { findPayment } from '@/lib/paymentLookup'
import { removePaymentEntry } from '@/lib/duesOps'
import { approvalView, createApproval } from '@/lib/approvals'
import { can } from '@/lib/policy'

// Removes a payment entry recorded by mistake. The owner removes directly;
// managers and accountants send a request (with a reason) for the owner to approve.
export const DELETE = route(async ({ request, params, org, scope, actor }) => {
  const payment = await findPayment(scope, params.id)
  if (can(actor, 'rent.removeEntry')) {
    await removePaymentEntry(payment, params.txId, { actor, request, orgId: org._id })
    return json(payment)
  }
  if (can(actor, 'rent.requestRemoveEntry')) {
    const body = await request.json().catch(() => ({}))
    const approval = await createApproval({
      type: 'org.payment.removeEntry', payload: { paymentId: params.id, txId: params.txId }, reason: body?.reason, actor, request,
    })
    return json({ approval: approvalView(approval, actor), message: 'Sent to the owner for approval.' }, 202)
  }
  throw new ApiError(403, 'Your role cannot remove payments.')
}, { permission: 'rent.view' })
