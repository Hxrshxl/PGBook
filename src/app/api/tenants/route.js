import Tenant from '@/lib/models/Tenant'
import { route, readJson, json, APP_TIME_ZONE } from '@/lib/api'
import { tenantInput, tenantView } from '@/lib/tenantFields'
import { ensureDue } from '@/lib/billing'
import { resolveRoom } from '@/lib/rooms'
import { tenantTarget } from '@/lib/auditTargets'
import { can } from '@/lib/policy'
import { getCurrentMonth, isBillableMonth } from '@/utils/helpers'

export const GET = route(async ({ scope, actor }) => {
  const tenants = await Tenant.find(scope.filter()).sort({ createdAt: 1 })
  const kyc = can(actor, 'tenants.kyc')
  return json(tenants.map(t => tenantView(t, kyc)))
}, { permission: 'tenants.view' })

// Creates the tenant in a room with a free bed and, if they already live there, this month's dues.
export const POST = route(async ({ request, org, scope, actor, audit }) => {
  const body = await readJson(request)
  const property = await scope.defaultProperty(body.propertyId)
  const room = await resolveRoom({ orgId: org._id, property, roomId: body.roomId, roomName: body.room, rent: Number(body.rentAmount) || 0 })

  const tenant = await Tenant.create({
    ...tenantInput(body),
    userId: org._id,
    propertyId: property._id,
    roomId: room._id,
    room: room.name,
    status: 'active',
  })

  const month = getCurrentMonth(APP_TIME_ZONE)
  const payment = isBillableMonth(tenant.moveInDate, month) ? await ensureDue(org._id, tenant, month) : null
  await audit('tenant.create', { target: tenantTarget(tenant), details: { rent: tenant.rentAmount, moveInDate: tenant.moveInDate, property: property.name } })
  return json({ tenant: tenantView(tenant, can(actor, 'tenants.kyc')), payment }, 201)
}, { permission: 'tenants.manage' })
