import Payment from '@/lib/models/Payment'
import { json, ApiError, assertObjectId } from '@/lib/api'
import { residentRoute } from '@/lib/residentApi'
import { propertyView } from '@/lib/residentData'

// Data for a printable rent receipt (HRA proof). Former tenants keep access.
export const GET = residentRoute(async ({ params, tenant, org, property }) => {
  assertObjectId(params.paymentId, 'Receipt')
  const payment = await Payment.findOne({ _id: params.paymentId, userId: org._id, tenantId: tenant._id })
  if (!payment || !(payment.amountPaid > 0)) throw new ApiError(404, 'No receipt for this month yet.')
  const p = propertyView(property) ?? {}
  return json({
    payment: payment.toJSON(),
    tenant: { name: tenant.name, room: tenant.room },
    settings: { pgName: p.name ?? '', address: p.address ?? '', phone: p.phone ?? '', logoText: p.logoText ?? '', ownerName: p.ownerName ?? '', gstin: p.gstin ?? '' },
  })
})
