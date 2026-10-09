// What a resident sees about their own stays. Never includes other residents,
// the owner's private notes, or anything outside the resident's own tenancy.
import Tenant from './models/Tenant.js'
import Property from './models/Property.js'
import User from './models/User.js'
import Payment from './models/Payment.js'
import PaymentClaim from './models/PaymentClaim.js'
import Notice from './models/Notice.js'
import Complaint from './models/Complaint.js'
import MoveOutRequest from './models/MoveOutRequest.js'
import DepositSettlement from './models/DepositSettlement.js'
import { stayAccess } from './residentApi.js'
import { APP_TIME_ZONE } from './api.js'
import {
  chargesTotal, formatMonth, getBalance, getCurrentMonth, getPaymentEntries, getTotalDue, roundMoney, todayISO,
} from '../utils/helpers.js'

const pad = n => String(n).padStart(2, '0')
export const VISIBLE_SETTLEMENT = ['shared', 'accepted', 'disputed', 'closed']

export async function tenanciesFor(resident) {
  const tenants = await Tenant.find({ residentId: resident._id }).sort({ status: 1, moveInDate: -1 })
  const [properties, orgs] = await Promise.all([
    Property.find({ _id: { $in: tenants.map(t => t.propertyId).filter(Boolean) } }).select('name city'),
    User.find({ _id: { $in: tenants.map(t => t.userId) } }).select('name status plan trialEndsAt createdAt billing'),
  ])
  const prop = new Map(properties.map(p => [String(p._id), p]))
  const org = new Map(orgs.map(o => [String(o._id), o]))
  return tenants.map(t => ({
    id: t._id.toString(),
    name: t.name,
    room: t.room,
    status: t.status,
    moveInDate: t.moveInDate,
    moveOutDate: t.moveOutDate,
    pgName: prop.get(String(t.propertyId))?.name ?? '',
    city: prop.get(String(t.propertyId))?.city ?? '',
    access: stayAccess(t, org.get(String(t.userId))).access,
  }))
}

export function propertyView(property) {
  if (!property) return null
  return {
    name: property.name, address: property.address, city: property.city, phone: property.phone,
    upiId: property.upiId, rentDueDay: property.rentDueDay, noticePeriodDays: property.noticePeriodDays ?? 30,
    lateFee: property.lateFee?.enabled ? { graceDays: property.lateFee.graceDays, type: property.lateFee.type, amount: property.lateFee.amount, maxAmount: property.lateFee.maxAmount } : null,
    gstin: property.gstin, logoText: property.logoText, ownerName: property.ownerName,
  }
}

export function stayView(tenant) {
  return {
    id: tenant._id.toString(), name: tenant.name, phone: tenant.phone, email: tenant.email, room: tenant.room,
    rentAmount: tenant.rentAmount, recurringCharges: tenant.recurringCharges ?? [], monthlyTotal: roundMoney(tenant.rentAmount + chargesTotal(tenant.recurringCharges)),
    depositAmount: tenant.depositAmount, moveInDate: tenant.moveInDate, moveOutDate: tenant.moveOutDate, status: tenant.status,
    noticeGivenAt: tenant.noticeGivenAt, expectedMoveOut: tenant.expectedMoveOut,
    emergencyContact: tenant.emergencyContact,
  }
}

export function dueView(payment, claims = []) {
  return {
    id: payment._id.toString(), month: payment.month, monthLabel: formatMonth(payment.month),
    rentAmount: payment.rentAmount, utilityShare: payment.utilityShare, extraCharges: payment.extraCharges ?? [], lateFee: payment.lateFee ?? 0,
    totalDue: getTotalDue(payment), amountPaid: payment.amountPaid, balance: getBalance(payment), status: payment.status, notes: payment.notes,
    entries: getPaymentEntries(payment.toJSON()).map(e => ({ id: e.id, amount: e.amount, date: e.date, method: e.method, source: e.source ?? null })),
    claims: claims.filter(c => String(c.paymentId) === String(payment._id)).map(claimView),
  }
}

export function claimView(c) {
  return {
    id: c._id.toString(), paymentId: String(c.paymentId), month: c.month, amount: c.amount, date: c.date, method: c.method, utr: c.utr,
    status: c.status, decisionNote: c.decisionNote, decidedAt: c.decidedAt, createdAt: c.createdAt,
  }
}

export function complaintView(c) {
  return {
    id: c._id.toString(), category: c.category, description: c.description, priority: c.priority, status: c.status,
    update: c.ownerNotes, createdAt: c.createdAt, resolvedAt: c.resolvedAt, closedAt: c.closedAt, closedBy: c.closedBy,
    withdrawnAt: c.withdrawnAt, photoIds: (c.photoIds ?? []).map(String), source: c.source, okToEnter: c.okToEnter, reopenCount: c.reopenCount,
  }
}

export function noticeView(n, tenantId) {
  return {
    id: n._id.toString(), title: n.title, body: n.body, pinned: n.pinned, requiresAck: n.requiresAck, createdAt: n.createdAt,
    acknowledged: (n.acks ?? []).some(a => String(a.tenantId) === String(tenantId)),
  }
}

export function settlementView(s) {
  return {
    id: s._id.toString(), moveOutDate: s.moveOutDate, deposit: s.deposit, unpaidDues: (s.unpaidDues ?? []).map(d => ({ month: d.month, monthLabel: formatMonth(d.month), amount: d.amount })),
    deductions: s.deductions ?? [], refundAmount: s.refundAmount, status: s.status, sharedAt: s.sharedAt,
    tenantResponse: s.tenantResponse ?? null, refund: s.refund ? { amount: s.refund.amount, method: s.refund.method, reference: s.refund.reference, date: s.refund.date } : null,
    notes: s.notes,
  }
}

export function noticeFilter(tenant) {
  return { orgId: tenant.userId, status: 'active', $or: [{ propertyIds: { $size: 0 } }, { propertyIds: tenant.propertyId }] }
}

/** Everything the home screen needs. */
export async function residentSummary({ tenant, org, property, access, readReason }) {
  const month = getCurrentMonth(APP_TIME_ZONE)
  const [payments, claims, notices, complaints, moveOut, settlement] = await Promise.all([
    Payment.find({ userId: org._id, tenantId: tenant._id }).sort({ month: -1 }),
    PaymentClaim.find({ tenantId: tenant._id, status: 'pending' }).sort({ createdAt: -1 }),
    Notice.find(noticeFilter(tenant)).sort({ pinned: -1, createdAt: -1 }).limit(5),
    Complaint.find({ userId: org._id, tenantId: tenant._id, closedAt: null, withdrawnAt: null }).sort({ createdAt: -1 }).limit(5),
    MoveOutRequest.findOne({ tenantId: tenant._id, status: { $in: ['pending', 'acknowledged'] } }).sort({ createdAt: -1 }),
    DepositSettlement.findOne({ tenantId: tenant._id, status: { $in: VISIBLE_SETTLEMENT } }).sort({ createdAt: -1 }),
  ])
  const open = payments.filter(p => getBalance(p) > 0)
  const totalDue = roundMoney(open.reduce((s, p) => s + getBalance(p), 0))
  const pendingClaimTotal = roundMoney(claims.reduce((s, c) => s + c.amount, 0))
  const current = payments.find(p => p.month === month)
  const dueDay = property?.rentDueDay ?? 5
  const today = todayISO(APP_TIME_ZONE)
  const dueDate = `${month}-${pad(dueDay)}`
  const payAmount = Math.max(0, roundMoney(totalDue - pendingClaimTotal))

  return {
    access, readReason,
    stay: stayView(tenant),
    property: propertyView(property),
    dues: {
      totalDue, pendingClaimTotal, payAmount,
      current: current ? dueView(current, claims) : null,
      openMonths: open.map(p => ({ id: p._id.toString(), month: p.month, monthLabel: formatMonth(p.month), balance: getBalance(p) })),
      dueDate, overdue: totalDue > 0 && (today > dueDate || open.some(p => p.month < month)),
      upi: property?.upiId && payAmount > 0 ? {
        pa: property.upiId, pn: property.name, am: payAmount,
        tn: `Rent ${formatMonth(month)} ${tenant.room}`.slice(0, 50),
      } : null,
    },
    claims: claims.map(claimView),
    notices: notices.map(n => noticeView(n, tenant._id)),
    complaints: complaints.map(complaintView),
    moveOut: moveOut ? { id: moveOut._id.toString(), moveOutDate: moveOut.moveOutDate, status: moveOut.status, createdAt: moveOut.createdAt, earliestDate: moveOut.earliestDate } : null,
    settlement: settlement ? settlementView(settlement) : null,
  }
}
