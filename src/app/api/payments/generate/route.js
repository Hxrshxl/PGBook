import { route, readJson, json, ApiError } from '@/lib/api'
import { generateDues } from '@/lib/billing'
import { isValidMonth } from '@/utils/helpers'

// Creates missing dues for all active tenants for a month (optionally one property). Idempotent.
export const POST = route(async ({ request, org, scope, audit }) => {
  const { month, propertyId } = await readJson(request)
  if (!isValidMonth(month)) throw new ApiError(400, 'Month must be YYYY-MM.')
  const { userId: _org, ...propertyFilter } = scope.filter()
  const tenantFilter = propertyId ? { propertyId: (await scope.property(propertyId))._id } : propertyFilter
  const payments = await generateDues(org._id, month, tenantFilter)
  if (payments.length) await audit('dues.generate', { details: { month, count: payments.length } })
  return json({ payments }, 201)
}, { permission: 'rent.manage' })
