import { NextResponse } from 'next/server'
import Tenant from '@/lib/models/Tenant'
import Payment from '@/lib/models/Payment'
import PaymentClaim from '@/lib/models/PaymentClaim'
import Complaint from '@/lib/models/Complaint'
import MoveOutRequest from '@/lib/models/MoveOutRequest'
import DepositSettlement from '@/lib/models/DepositSettlement'
import Property from '@/lib/models/Property'
import { residentRoute } from '@/lib/residentApi'
import { claimView, complaintView, dueView, settlementView, stayView } from '@/lib/residentData'
import { rateLimit } from '@/lib/rateLimit'

// "Download my data": the resident's own records across all their stays, as JSON.
// The PG's private notes about them are not included.
export const GET = residentRoute(async ({ resident }) => {
  if (!rateLimit(`resident-export:${resident._id}`, { limit: 5, windowMs: 60 * 60 * 1000 }).ok) {
    return NextResponse.json({ message: 'Please try again later.' }, { status: 429 })
  }
  const tenants = await Tenant.find({ residentId: resident._id })
  const stays = []
  for (const t of tenants) {
    const [property, payments, claims, complaints, moveOuts, settlements] = await Promise.all([
      t.propertyId ? Property.findById(t.propertyId).select('name address city') : null,
      Payment.find({ userId: t.userId, tenantId: t._id }).sort({ month: 1 }),
      PaymentClaim.find({ tenantId: t._id }),
      Complaint.find({ userId: t.userId, tenantId: t._id }),
      MoveOutRequest.find({ tenantId: t._id }),
      DepositSettlement.find({ tenantId: t._id, status: { $in: ['shared', 'accepted', 'disputed', 'closed'] } }),
    ])
    stays.push({
      pg: property ? { name: property.name, address: property.address, city: property.city } : null,
      stay: { ...stayView(t), idType: t.idType, idNumber: t.idNumber },
      dues: payments.map(p => dueView(p, claims)),
      paymentReports: claims.map(claimView),
      complaints: complaints.map(complaintView),
      moveOutNotices: moveOuts.map(m => ({ moveOutDate: m.moveOutDate, reason: m.reason, status: m.status, givenAt: m.createdAt })),
      depositSettlements: settlements.map(settlementView),
    })
  }
  const body = JSON.stringify({ exportedAt: new Date().toISOString(), account: { phone: `+${resident.phone}`, name: resident.name, consentAt: resident.consentAt }, stays }, null, 2)
  return new NextResponse(body, {
    headers: { 'Content-Type': 'application/json', 'Content-Disposition': 'attachment; filename="my-pgbook-data.json"', 'Cache-Control': 'no-store' },
  })
}, { stay: false })
