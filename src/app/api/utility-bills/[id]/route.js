import UtilityBill from '@/lib/models/UtilityBill'
import { route, json, assertObjectId, ApiError } from '@/lib/api'
import { recomputeUtilityShares } from '@/lib/billing'
import { billTarget } from '@/lib/auditTargets'

// Deletes a bill and removes its shares from the affected tenants' dues.
export const DELETE = route(async ({ params, user, audit }) => {
  assertObjectId(params.id, 'Bill')
  const bill = await UtilityBill.findOneAndDelete({ _id: params.id, userId: user._id })
  if (!bill) throw new ApiError(404, 'Bill not found.')

  const payments = await recomputeUtilityShares(user._id, bill.month, bill.allocations.map(a => a.tenantId))
  await audit('bill.delete', { target: billTarget(bill), details: { type: bill.type, amount: bill.totalAmount, month: bill.month, duesUpdated: payments.length } })
  return json({ ok: true, payments })
}, { permission: 'bills.manage' })
