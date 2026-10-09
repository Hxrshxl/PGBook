import MoveOutRequest from '@/lib/models/MoveOutRequest'
import Tenant from '@/lib/models/Tenant'
import { route, readJson, json, ApiError, assertObjectId } from '@/lib/api'
import { recordedBy } from '@/lib/paymentLookup'
import { notifyResident } from '@/lib/notify'
import { formatDate } from '@/utils/helpers'

// Acknowledge a tenant's move-out notice (they are now "on notice"), or decline it with a reason.
export const POST = route(async ({ request, params, scope, actor, audit }) => {
  assertObjectId(params.id, 'Move-out notice')
  const { decision, note = '' } = await readJson(request)
  if (!['acknowledge', 'decline'].includes(decision)) throw new ApiError(400, 'Decision must be acknowledge or decline.')
  const reason = String(note).trim()
  if (decision === 'decline' && reason.length < 3) throw new ApiError(400, 'Tell the tenant why.')

  const req = await MoveOutRequest.findOneAndUpdate(
    { _id: params.id, ...scope.filter({ status: 'pending' }, 'orgId') },
    { $set: { status: decision === 'acknowledge' ? 'acknowledged' : 'declined', decidedBy: recordedBy(actor), decidedAt: new Date(), decisionNote: reason } },
    { new: true },
  )
  if (!req) throw new ApiError(409, 'This notice was already handled or withdrawn.')
  if (decision === 'acknowledge') {
    await Tenant.updateOne({ _id: req.tenantId }, { $set: { noticeGivenAt: req.createdAt, expectedMoveOut: req.moveOutDate } })
  }
  await audit(`moveout.${req.status}`, { target: { kind: 'tenant', id: String(req.tenantId), label: req.tenantName }, reason, details: { moveOutDate: req.moveOutDate } })
  await notifyResident({
    residentId: req.residentId, orgId: req.orgId, type: `moveout.${req.status}`, tone: decision === 'acknowledge' ? 'success' : 'warning', link: '/t/requests',
    title: decision === 'acknowledge' ? `Your move-out on ${formatDate(req.moveOutDate)} is acknowledged` : 'Your move-out notice was not accepted',
    body: decision === 'acknowledge' ? 'Your PG will share the deposit settlement around your move-out date.' : `Reason: ${reason}`,
  })
  return json(req)
}, { permission: 'tenants.manage' })
