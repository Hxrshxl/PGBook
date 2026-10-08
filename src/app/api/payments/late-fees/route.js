import { route, readJson, json, ApiError, APP_TIME_ZONE } from '@/lib/api'
import { applyLateFees } from '@/lib/billing'
import { isValidMonth, roundMoney, todayISO } from '@/utils/helpers'

// Applies each property's late-fee rule to a month's overdue dues. Safe to run repeatedly.
export const POST = route(async ({ request, org, scope, audit }) => {
  const { month, propertyId } = await readJson(request)
  if (!isValidMonth(month)) throw new ApiError(400, 'Month must be YYYY-MM.')
  const { userId: _org, ...propertyFilter } = scope.filter()
  const filter = propertyId ? { propertyId: (await scope.property(propertyId))._id } : propertyFilter
  const payments = await applyLateFees(org._id, month, todayISO(APP_TIME_ZONE), filter)
  if (payments.length) {
    await audit('dues.late_fees_applied', { details: { month, count: payments.length, total: roundMoney(payments.reduce((s, p) => s + p.lateFee, 0)) } })
  }
  return json({ payments })
}, { permission: 'rent.lateFees' })
