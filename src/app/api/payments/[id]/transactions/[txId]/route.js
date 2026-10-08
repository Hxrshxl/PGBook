import { route, json, ApiError } from '@/lib/api'
import { findPayment } from '@/lib/paymentLookup'
import { paymentTarget } from '@/lib/auditTargets'

// Removes a payment entry recorded by mistake.
export const DELETE = route(async ({ params, user, audit }) => {
  const payment = await findPayment(user, params.id)
  const tx = payment.transactions.id(params.txId)
  if (!tx) throw new ApiError(404, 'Payment entry not found.')
  const removed = { amount: tx.amount, method: tx.method, date: tx.date }
  tx.deleteOne()
  await payment.save()
  await audit('payment.remove', { target: await paymentTarget(payment), details: { month: payment.month, ...removed } })
  return json(payment)
}, { permission: 'rent.removeEntry' })
