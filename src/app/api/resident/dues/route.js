import Payment from '@/lib/models/Payment'
import PaymentClaim from '@/lib/models/PaymentClaim'
import { json } from '@/lib/api'
import { residentRoute } from '@/lib/residentApi'
import { dueView, propertyView, stayView } from '@/lib/residentData'

// Month-by-month dues, payments received and payment claims for this stay.
export const GET = residentRoute(async ({ tenant, org, property, access }) => {
  const [payments, claims] = await Promise.all([
    Payment.find({ userId: org._id, tenantId: tenant._id }).sort({ month: -1 }),
    PaymentClaim.find({ tenantId: tenant._id }).sort({ createdAt: -1 }).limit(100),
  ])
  return json({ access, stay: stayView(tenant), property: propertyView(property), dues: payments.map(p => dueView(p, claims)) })
})
