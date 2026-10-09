import MoveOutRequest from '@/lib/models/MoveOutRequest'
import { json, ApiError, assertObjectId } from '@/lib/api'
import { residentRoute } from '@/lib/residentApi'

// Withdraw a move-out notice the PG hasn't acknowledged yet.
export const DELETE = residentRoute(async ({ params, tenant, audit }) => {
  assertObjectId(params.id, 'Notice')
  const req = await MoveOutRequest.findOneAndUpdate(
    { _id: params.id, tenantId: tenant._id, status: 'pending' },
    { $set: { status: 'withdrawn', decidedAt: new Date() } },
    { new: true },
  )
  if (!req) throw new ApiError(409, 'This notice was already acknowledged by your PG. Please talk to them to change it.')
  await audit('moveout.withdrawn', { target: { kind: 'tenant', id: tenant._id.toString(), label: tenant.name }, details: { moveOutDate: req.moveOutDate } })
  return json({ ok: true })
})
