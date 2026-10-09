import PaymentClaim from '@/lib/models/PaymentClaim'
import { route, readJson, json, ApiError, assertObjectId } from '@/lib/api'
import { findPayment, recordedBy } from '@/lib/paymentLookup'
import { notifyResident } from '@/lib/notify'
import { formatCurrency, formatMonth, getBalance } from '@/utils/helpers'

// Approve a tenant's "I've paid" (the payment goes on the ledger, attributed to the tenant's
// report and the approver) or reject it with a reason the tenant sees.
export const POST = route(async ({ request, params, scope, actor, audit }) => {
  assertObjectId(params.id, 'Payment report')
  const { decision, note = '' } = await readJson(request)
  if (!['approve', 'reject'].includes(decision)) throw new ApiError(400, 'Decision must be approve or reject.')
  const reason = String(note).trim()
  if (decision === 'reject' && reason.length < 3) throw new ApiError(400, 'Tell the tenant why (e.g. no payment received with that UTR).')

  // Claim the decision atomically so two reviewers can't both post it.
  const claim = await PaymentClaim.findOneAndUpdate(
    { _id: params.id, ...scope.filter({ status: 'pending' }, 'orgId') },
    { $set: { status: decision === 'approve' ? 'approved' : 'rejected', decidedBy: recordedBy(actor), decidedAt: new Date(), decisionNote: reason } },
    { new: true },
  )
  if (!claim) throw new ApiError(409, 'This payment report was already decided or withdrawn.')
  const target = { kind: 'payment', id: String(claim.paymentId), label: `${claim.tenantName} (Room ${claim.room})` }

  let payment = null
  if (decision === 'approve') {
    try {
      payment = await findPayment(scope, claim.paymentId)
      if (claim.amount > getBalance(payment) + 0.5) {
        throw new ApiError(409, `This is more than the ${formatCurrency(getBalance(payment))} still due for ${formatMonth(claim.month)}. Adjust the dues first, or reject it.`)
      }
      payment.transactions.push({
        amount: claim.amount, date: claim.date, method: claim.method,
        note: [claim.utr ? `UTR ${claim.utr}` : '', 'reported in tenant app'].filter(Boolean).join(' · ').slice(0, 200),
        recordedBy: recordedBy(actor), source: 'claim',
      })
      await payment.save()
      claim.transactionId = payment.transactions[payment.transactions.length - 1]._id
      await claim.save()
    } catch (err) {
      await PaymentClaim.updateOne({ _id: claim._id }, { $set: { status: 'pending', decidedBy: undefined, decidedAt: null, decisionNote: '' } })
      throw err
    }
  }

  await audit(decision === 'approve' ? 'claim.approved' : 'claim.rejected', { target, reason, details: { amount: claim.amount, month: claim.month, utr: claim.utr } })
  await notifyResident({
    residentId: claim.residentId, orgId: claim.orgId, type: `claim.${claim.status}`, tone: decision === 'approve' ? 'success' : 'danger', link: '/t/pay',
    title: decision === 'approve' ? `${formatCurrency(claim.amount)} confirmed — receipt ready` : `Your payment of ${formatCurrency(claim.amount)} was not confirmed`,
    body: decision === 'approve' ? `Your PG confirmed your payment for ${formatMonth(claim.month)}.` : `Reason: ${reason}`,
  })
  return json({ claim, payment })
}, { permission: 'claims.review' })
