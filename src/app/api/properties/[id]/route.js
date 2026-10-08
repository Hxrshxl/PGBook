import Property from '@/lib/models/Property'
import Tenant from '@/lib/models/Tenant'
import { route, readJson, json, ApiError } from '@/lib/api'
import { propertyInput, updateProperty } from '@/lib/propertyFields'

// Update a property's details, payment settings and rules (owner only).
export const PUT = route(async ({ request, params, org, scope, actor }) => {
  const property = await scope.property(params.id)
  const body = await readJson(request)
  await updateProperty(property, propertyInput(body), { actor, orgId: org._id, request })
  return json(property)
}, { permission: 'settings.manage' })

// Archive a property. Only possible once nobody lives there, and never the last one.
export const DELETE = route(async ({ params, org, scope, audit }) => {
  const property = await scope.property(params.id)
  if (await Tenant.exists({ userId: org._id, propertyId: property._id, status: 'active' })) {
    throw new ApiError(409, `${property.name} still has active tenants. Vacate or move them first.`)
  }
  if ((await Property.countDocuments({ orgId: org._id, status: 'active' })) <= 1) {
    throw new ApiError(409, 'You need at least one property.')
  }
  property.status = 'archived'
  await property.save()
  await audit('property.archive', { target: { kind: 'property', id: property._id.toString(), label: property.name } })
  return json({ ok: true })
}, { permission: 'properties.manage' })
