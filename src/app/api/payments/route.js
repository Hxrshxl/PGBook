import Payment from '@/lib/models/Payment'
import Tenant from '@/lib/models/Tenant'
import { route, readJson, json, assertObjectId, ApiError } from '@/lib/api'
import { ensureDue, recomputeUtilityShares } from '@/lib/billing'
import { paymentTarget } from '@/lib/auditTargets'
import { isValidMonth } from '@/utils/helpers'

export const GET = route(async ({ scope }) => {
  const payments = await Payment.find(scope.filter()).sort({ month: -1, createdAt: -1 })
  return json(payments)
}, { permission: 'rent.view' })

// Creates the dues record for one tenant + month. Amounts paid are recorded
// separately through /api/payments/[id]/transactions.
export const POST = route(async ({ request, org, scope, audit }) => {
  const { tenantId, month, rentAmount } = await readJson(request)
  assertObjectId(tenantId, 'Tenant')
  if (!isValidMonth(month)) throw new ApiError(400, 'Month must be YYYY-MM.')

  const tenant = await Tenant.findOne({ _id: tenantId, ...scope.filter() })
  if (!tenant) throw new ApiError(404, 'Tenant not found.')
  if (await Payment.exists({ userId: org._id, tenantId, month })) {
    throw new ApiError(409, 'Dues for this tenant and month already exist.')
  }

  let payment = await ensureDue(org._id, tenant, month)
  if (rentAmount !== undefined && rentAmount !== payment.rentAmount) {
    payment.rentAmount = rentAmount
    await payment.save()
  }
  const [recomputed] = await recomputeUtilityShares(org._id, month, [tenant._id])
  payment = recomputed ?? payment
  await audit('dues.create', { target: await paymentTarget(payment), details: { month, rent: payment.rentAmount } })
  return json(payment, 201)
}, { permission: 'rent.manage' })
