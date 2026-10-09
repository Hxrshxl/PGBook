import Tenant from '@/lib/models/Tenant'
import DepositSettlement from '@/lib/models/DepositSettlement'
import { route, readJson, json, ApiError, assertObjectId, APP_TIME_ZONE } from '@/lib/api'
import { recordedBy } from '@/lib/paymentLookup'
import { cleanDeductions, refreshSettlement } from '@/lib/settlements'
import { isValidDate, todayISO } from '@/utils/helpers'

// Start a deposit settlement for a tenant who is leaving or has left.
export const POST = route(async ({ request, org, scope, actor, audit }) => {
  const { tenantId, moveOutDate, deductions = [], notes = '' } = await readJson(request)
  assertObjectId(tenantId, 'Tenant')
  const tenant = await Tenant.findOne({ _id: tenantId, ...scope.filter() })
  if (!tenant) throw new ApiError(404, 'Tenant not found.')
  if (await DepositSettlement.exists({ tenantId: tenant._id, status: { $nin: ['closed', 'cancelled'] } })) {
    throw new ApiError(409, 'This tenant already has a settlement in progress.')
  }
  const date = moveOutDate || tenant.moveOutDate || tenant.expectedMoveOut || todayISO(APP_TIME_ZONE)
  if (!isValidDate(date)) throw new ApiError(400, 'Move-out date must be YYYY-MM-DD.')

  const s = new DepositSettlement({
    orgId: org._id, propertyId: tenant.propertyId, tenantId: tenant._id, residentId: tenant.residentId,
    tenantName: tenant.name, room: tenant.room, moveOutDate: date, deposit: tenant.depositAmount ?? 0,
    deductions: cleanDeductions(deductions), notes: String(notes).trim(), preparedBy: recordedBy(actor), refundAmount: 0,
  })
  await refreshSettlement(s)
  await s.save()
  await audit('settlement.drafted', { target: { kind: 'tenant', id: tenant._id.toString(), label: tenant.name }, details: { deposit: s.deposit, refund: s.refundAmount } })
  return json(s, 201)
}, { permission: 'deposits.manage' })
