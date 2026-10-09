// GST invoices for PGBook subscriptions.
//
// Seller details come from the environment:
//   BILLING_LEGAL_NAME, BILLING_ADDRESS, BILLING_GSTIN, BILLING_STATE_CODE (e.g. 29), BILLING_EMAIL
// Without BILLING_GSTIN PGBook isn't GST-registered, so invoices carry no GST.
// Plan prices include GST: ₹499 = ₹422.88 taxable + ₹76.12 GST.
import Invoice from './models/Invoice.js'
import Property from './models/Property.js'
import { nextSequence } from './models/Counter.js'
import { PLANS } from './plans.js'
import { financialYear, gstBreakup } from '../utils/gst.js'

export const GST_RATE = 18

export function sellerDetails() {
  const gstin = (process.env.BILLING_GSTIN ?? '').trim().toUpperCase()
  return {
    name: process.env.BILLING_LEGAL_NAME || 'PGBook',
    gstin,
    address: process.env.BILLING_ADDRESS || '',
    stateCode: process.env.BILLING_STATE_CODE || (gstin ? gstin.slice(0, 2) : '29'),
    email: process.env.BILLING_EMAIL || 'billing@pgbook.in',
  }
}

/** Who the invoice is addressed to: the owner's billing details, falling back to their first property. */
export async function buyerDetails(org) {
  const d = org.billing?.details ?? {}
  const property = await Property.findOne({ orgId: org._id }).sort({ createdAt: 1 }).select('name address city gstin')
  const gstin = d.gstin || property?.gstin || ''
  return {
    name: d.legalName || property?.name || org.name,
    gstin,
    address: d.address || [property?.address, property?.city].filter(Boolean).join(', '),
    stateCode: d.stateCode || (gstin ? gstin.slice(0, 2) : ''),
    email: d.email || org.email,
  }
}

export async function nextInvoiceNumber(date) {
  const fy = financialYear(date)
  const seq = await nextSequence(`invoice:${fy}`)
  return { fy, number: `PGB/${fy}/${String(seq).padStart(5, '0')}` }
}

/**
 * Issues the invoice for a successful payment. Idempotent per provider payment id,
 * so a webhook delivered twice never creates two invoices.
 */
export async function issueInvoice(org, { plan, interval, total, periodStart, periodEnd, provider, providerPaymentId, paidAt = new Date() }) {
  if (providerPaymentId) {
    const existing = await Invoice.findOne({ providerPaymentId })
    if (existing) return existing
  }
  const seller = sellerDetails()
  const buyer = await buyerDetails(org)
  const tax = gstBreakup(total, {
    sellerGstin: seller.gstin, sellerState: seller.stateCode, buyerState: buyer.stateCode || seller.stateCode, rate: GST_RATE,
  })
  const { fy, number } = await nextInvoiceNumber(paidAt)
  return Invoice.create({
    orgId: org._id, number, fy, issuedAt: paidAt, plan, interval,
    description: `PGBook ${PLANS[plan]?.label ?? plan} plan — ${interval === 'yearly' ? 'yearly' : 'monthly'} subscription`,
    periodStart, periodEnd,
    total: tax.total, taxable: tax.taxable, cgst: tax.cgst, sgst: tax.sgst, igst: tax.igst, gstRate: tax.rate,
    seller, buyer, provider, providerPaymentId,
  })
}
