import Property from '@/lib/models/Property'
import { route, readJson, json, ApiError } from '@/lib/api'
import { legacySettings, propertyInput, updateProperty } from '@/lib/propertyFields'

// Compatibility endpoint from the single-PG days: reads and updates the first property.
// New code uses /api/properties.
async function firstProperty(scope) {
  const property = await Property.findOne(scope.propertyQuery({ status: 'active' })).sort({ createdAt: 1 })
  if (!property) throw new ApiError(404, 'No property found.')
  return property
}

export const GET = route(async ({ scope }) => json(legacySettings(await firstProperty(scope))), { permission: 'settings.view' })

export const PUT = route(async ({ request, org, scope, actor }) => {
  const body = await readJson(request)
  const input = propertyInput({ ...body, name: body.pgName ?? body.name })
  if (input.name === undefined) delete input.name
  const property = await updateProperty(await firstProperty(scope), input, { actor, orgId: org._id, request })
  return json(legacySettings(property))
}, { permission: 'settings.manage' })
