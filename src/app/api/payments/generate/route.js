import { route, readJson, json, ApiError } from '@/lib/api'
import { generateDues } from '@/lib/billing'
import { isValidMonth } from '@/utils/helpers'

// Creates missing dues for all active tenants for a month. Idempotent.
export const POST = route(async ({ request, user, audit }) => {
  const { month } = await readJson(request)
  if (!isValidMonth(month)) throw new ApiError(400, 'Month must be YYYY-MM.')
  const payments = await generateDues(user._id, month)
  if (payments.length) await audit('dues.generate', { details: { month, count: payments.length } })
  return json({ payments }, 201)
}, { permission: 'rent.manage' })
