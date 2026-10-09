import PaymentClaim from '@/lib/models/PaymentClaim'
import { readJson, json, ApiError, assertObjectId } from '@/lib/api'
import { residentRoute } from '@/lib/residentApi'
import { claimView } from '@/lib/residentData'

// Withdraw a payment report that hasn't been decided yet (e.g. entered the wrong amount).
export const POST = residentRoute(async ({ request, params, tenant, audit }) => {
  assertObjectId(params.id, 'Payment report')
  const { action } = await readJson(request)
  if (action !== 'withdraw') throw new ApiError(400, 'Unknown action.')
  const claim = await PaymentClaim.findOneAndUpdate(
    { _id: params.id, tenantId: tenant._id, status: 'pending' },
    { $set: { status: 'withdrawn', decidedAt: new Date() } },
    { new: true },
  )
  if (!claim) throw new ApiError(409, 'This payment report was already decided.')
  await audit('claim.withdrawn', { target: { kind: 'payment', id: String(claim.paymentId), label: `${tenant.name} (Room ${tenant.room})` }, details: { amount: claim.amount, month: claim.month } })
  return json(claimView(claim))
})
