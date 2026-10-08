import Tenant from '@/lib/models/Tenant'
import Payment from '@/lib/models/Payment'
import Complaint from '@/lib/models/Complaint'
import { route, readJson, json, assertObjectId, ApiError, APP_TIME_ZONE } from '@/lib/api'
import { tenantInput, tenantView } from '@/lib/tenantFields'
import { resolveRoom } from '@/lib/rooms'
import { syncOpenDues } from '@/lib/billing'
import { tenantTarget } from '@/lib/auditTargets'
import { can } from '@/lib/policy'
import { getCurrentMonth, isValidDate, todayISO } from '@/utils/helpers'

async function findTenant(scope, id) {
  assertObjectId(id, 'Tenant')
  const tenant = await Tenant.findOne({ _id: id, ...scope.filter() })
  if (!tenant) throw new ApiError(404, 'Tenant not found.')
  return tenant
}

const chargesKey = t => JSON.stringify((t.recurringCharges ?? []).map(c => [c.label, c.amount]))

// Edit tenant details, move them to another room, or change their rent/charges.
// Rent and charge changes also update this and future months' dues with nothing paid yet.
export const PUT = route(async ({ request, params, org, scope, actor, audit }) => {
  const tenant = await findTenant(scope, params.id)
  const body = await readJson(request)
  const previous = { rent: tenant.rentAmount, charges: chargesKey(tenant), room: tenant.room }

  const input = tenantInput(body)
  if (!can(actor, 'tenants.kyc')) { delete input.idType; delete input.idNumber }
  tenant.set(input)

  const movingProperty = body.propertyId && String(body.propertyId) !== String(tenant.propertyId)
  const movingRoom = (body.roomId && String(body.roomId) !== String(tenant.roomId)) || (!body.roomId && body.room && body.room !== tenant.room)
  if (movingProperty || movingRoom) {
    const property = await scope.property(body.propertyId ?? tenant.propertyId)
    const room = await resolveRoom({ orgId: org._id, property, roomId: body.roomId, roomName: body.room, rent: tenant.rentAmount, excludeTenantId: tenant._id })
    tenant.propertyId = property._id
    tenant.roomId = room._id
    tenant.room = room.name
  }

  const fields = [...new Set(tenant.directModifiedPaths().map(p => p.split('.')[0]))]
  await tenant.save()

  const payments = (tenant.rentAmount !== previous.rent || chargesKey(tenant) !== previous.charges)
    ? await syncOpenDues(org._id, tenant, getCurrentMonth(APP_TIME_ZONE))
    : []
  if (fields.length) {
    const details = { fields }
    if (tenant.rentAmount !== previous.rent) Object.assign(details, { rentFrom: previous.rent, rentTo: tenant.rentAmount })
    if (tenant.room !== previous.room) Object.assign(details, { roomFrom: previous.room, roomTo: tenant.room })
    if (payments.length) details.duesUpdated = payments.length
    await audit('tenant.update', { target: tenantTarget(tenant), details })
  }
  return json({ tenant: tenantView(tenant, can(actor, 'tenants.kyc')), payments })
}, { permission: 'tenants.manage' })

// Vacate ({ status: 'vacated', moveOutDate? }) or reactivate ({ status: 'active' }).
export const PATCH = route(async ({ request, params, org, scope, actor, audit }) => {
  const tenant = await findTenant(scope, params.id)
  const body = await readJson(request).catch(() => ({}))
  const status = body.status ?? 'vacated'

  if (status === 'vacated') {
    const moveOutDate = body.moveOutDate ?? todayISO(APP_TIME_ZONE)
    if (!isValidDate(moveOutDate)) throw new ApiError(400, 'Move-out date must be YYYY-MM-DD.')
    if (tenant.moveInDate && moveOutDate < tenant.moveInDate) {
      throw new ApiError(400, 'Move-out date cannot be before the move-in date.')
    }
    tenant.status = 'vacated'
    tenant.moveOutDate = moveOutDate
  } else if (status === 'active') {
    if (tenant.status !== 'active' && tenant.roomId) {
      // Their bed may have been given to someone else since they left.
      const property = await scope.property(tenant.propertyId)
      await resolveRoom({ orgId: org._id, property, roomId: tenant.roomId, excludeTenantId: tenant._id })
    }
    tenant.status = 'active'
    tenant.moveOutDate = null
  } else {
    throw new ApiError(400, 'Status must be "active" or "vacated".')
  }
  await tenant.save()
  await audit(status === 'vacated' ? 'tenant.vacate' : 'tenant.restore', {
    target: tenantTarget(tenant), details: status === 'vacated' ? { moveOutDate: tenant.moveOutDate } : undefined,
  })
  return json(tenantView(tenant, can(actor, 'tenants.kyc')))
}, { permission: 'tenants.manage' })

// Permanently deletes the tenant together with their dues and complaints (owner only).
export const DELETE = route(async ({ params, org, scope, audit }) => {
  const tenant = await findTenant(scope, params.id)
  const [dues, complaints] = await Promise.all([
    Payment.deleteMany({ userId: org._id, tenantId: tenant._id }),
    Complaint.deleteMany({ userId: org._id, tenantId: tenant._id }),
  ])
  await tenant.deleteOne()
  await audit('tenant.delete', { target: tenantTarget(tenant), details: { duesDeleted: dues.deletedCount, complaintsDeleted: complaints.deletedCount } })
  return json({ ok: true })
}, { permission: 'tenants.delete' })
