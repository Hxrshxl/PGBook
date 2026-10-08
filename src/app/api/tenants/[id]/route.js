import Tenant from '@/lib/models/Tenant'
import Payment from '@/lib/models/Payment'
import Complaint from '@/lib/models/Complaint'
import { route, readJson, json, assertObjectId, ApiError, APP_TIME_ZONE } from '@/lib/api'
import { tenantInput } from '@/lib/tenantFields'
import { tenantTarget } from '@/lib/auditTargets'
import { getCurrentMonth, isValidDate, todayISO } from '@/utils/helpers'

async function findTenant(user, id) {
  assertObjectId(id, 'Tenant')
  const tenant = await Tenant.findOne({ _id: id, userId: user._id })
  if (!tenant) throw new ApiError(404, 'Tenant not found.')
  return tenant
}

// Edit tenant details. A rent change also updates this and future months'
// dues that have no payments recorded against them yet.
export const PUT = route(async ({ request, params, user, audit }) => {
  const tenant = await findTenant(user, params.id)
  const body = await readJson(request)
  const previousRent = tenant.rentAmount
  tenant.set(tenantInput(body))
  const fields = [...new Set(tenant.directModifiedPaths().map(p => p.split('.')[0]))]
  await tenant.save()

  const payments = []
  if (tenant.rentAmount !== previousRent) {
    const open = await Payment.find({
      userId: user._id,
      tenantId: tenant._id,
      month: { $gte: getCurrentMonth(APP_TIME_ZONE) },
      'transactions.0': { $exists: false },
      amountPaid: 0,
    })
    for (const payment of open) {
      payment.rentAmount = tenant.rentAmount
      await payment.save()
      payments.push(payment)
    }
  }
  if (fields.length) {
    const details = { fields }
    if (tenant.rentAmount !== previousRent) Object.assign(details, { rentFrom: previousRent, rentTo: tenant.rentAmount, duesUpdated: payments.length })
    await audit('tenant.update', { target: tenantTarget(tenant), details })
  }
  return json({ tenant, payments })
}, { permission: 'tenants.manage' })

// Vacate ({ status: 'vacated', moveOutDate? }) or reactivate ({ status: 'active' }).
export const PATCH = route(async ({ request, params, user, audit }) => {
  const tenant = await findTenant(user, params.id)
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
    tenant.status = 'active'
    tenant.moveOutDate = null
  } else {
    throw new ApiError(400, 'Status must be "active" or "vacated".')
  }
  await tenant.save()
  await audit(status === 'vacated' ? 'tenant.vacate' : 'tenant.restore', {
    target: tenantTarget(tenant), details: status === 'vacated' ? { moveOutDate: tenant.moveOutDate } : undefined,
  })
  return json(tenant)
}, { permission: 'tenants.manage' })

// Permanently deletes the tenant together with their dues and complaints.
export const DELETE = route(async ({ params, user, audit }) => {
  const tenant = await findTenant(user, params.id)
  const [dues, complaints] = await Promise.all([
    Payment.deleteMany({ userId: user._id, tenantId: tenant._id }),
    Complaint.deleteMany({ userId: user._id, tenantId: tenant._id }),
  ])
  await tenant.deleteOne()
  await audit('tenant.delete', { target: tenantTarget(tenant), details: { duesDeleted: dues.deletedCount, complaintsDeleted: complaints.deletedCount } })
  return json({ ok: true })
}, { permission: 'tenants.delete' })
