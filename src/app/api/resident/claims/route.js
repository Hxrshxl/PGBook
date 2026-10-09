import Payment from '@/lib/models/Payment'
import PaymentClaim from '@/lib/models/PaymentClaim'
import { readJson, json, ApiError, assertObjectId, APP_TIME_ZONE } from '@/lib/api'
import { residentRoute } from '@/lib/residentApi'
import { attachUploads } from '@/lib/files'
import { notifyOrg } from '@/lib/notify'
import { claimView } from '@/lib/residentData'
import { formatCurrency, formatMonth, getBalance, isValidDate, roundMoney, todayISO } from '@/utils/helpers'

const escapeRegex = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// "I've paid": the tenant reports a payment. Nothing changes on the ledger until
// the owner or their accountant approves it. Duplicate references and amounts above
// the balance are flagged for the reviewer, not silently accepted.
export const POST = residentRoute(async ({ request, tenant, org, audit }) => {
  const { paymentId, amount, date, method = 'upi', utr = '', note = '', screenshotId } = await readJson(request)
  assertObjectId(paymentId, 'Month')
  const payment = await Payment.findOne({ _id: paymentId, userId: org._id, tenantId: tenant._id })
  if (!payment) throw new ApiError(404, 'That month was not found.')

  const value = roundMoney(amount)
  if (!(value >= 1)) throw new ApiError(400, 'Enter the amount you paid.')
  if (!isValidDate(date) || date > todayISO(APP_TIME_ZONE)) throw new ApiError(400, 'Enter the date you paid (not in the future).')
  const reference = String(utr ?? '').trim().toUpperCase()
  if (['upi', 'bank'].includes(method) && reference.length < 6) {
    throw new ApiError(400, 'Enter the UTR / reference number from your payment app (usually 12 digits).')
  }
  if ((await PaymentClaim.countDocuments({ tenantId: tenant._id, status: 'pending' })) >= 3) {
    throw new ApiError(409, 'You already have 3 payments waiting for confirmation. Please wait for your PG to confirm them.')
  }

  const pendingForMonth = await PaymentClaim.find({ paymentId: payment._id, status: 'pending' }).select('amount')
  const flags = []
  if (value + pendingForMonth.reduce((s, c) => s + c.amount, 0) > getBalance(payment) + 0.5) flags.push('over_balance')
  if (reference) {
    const dupClaim = await PaymentClaim.exists({ orgId: org._id, utr: reference, status: { $in: ['pending', 'approved'] } })
    const dupEntry = await Payment.exists({ userId: org._id, 'transactions.note': { $regex: escapeRegex(reference), $options: 'i' } })
    if (dupClaim || dupEntry) flags.push('duplicate_utr')
  }

  const claim = new PaymentClaim({
    orgId: org._id, propertyId: tenant.propertyId, tenantId: tenant._id, residentId: tenant.residentId, paymentId: payment._id,
    tenantName: tenant.name, room: tenant.room, month: payment.month, amount: value, date, method, utr: reference,
    note: typeof note === 'string' ? note : '', flags,
  })
  if (screenshotId) {
    const [id] = await attachUploads([screenshotId], { tenantId: tenant._id, kind: 'claim', recordId: claim._id, max: 1 })
    claim.screenshotId = id
  }
  await claim.save()
  await audit('claim.submitted', {
    target: { kind: 'payment', id: payment._id.toString(), label: `${tenant.name} (Room ${tenant.room})` },
    details: { amount: value, month: payment.month, method, flags },
  })
  await notifyOrg({
    orgId: org._id, capability: 'claims.review', type: 'claims.new', tone: flags.length ? 'warning' : 'info', link: '/dashboard/approvals',
    title: `${tenant.name} reported paying ${formatCurrency(value)}`,
    body: `${formatMonth(payment.month)} · Room ${tenant.room}${reference ? ` · UTR ${reference}` : ''}${flags.length ? ` · check: ${flags.map(f => f.replace('_', ' ')).join(', ')}` : ''}. Confirm it in Approvals.`,
  })
  return json(claimView(claim), 201)
}, { write: true })
