import { route, readJson, json, pick, ApiError } from '@/lib/api'
import { findPayment } from '@/lib/paymentLookup'
import { paymentTarget } from '@/lib/auditTargets'
import { getTotalDue } from '@/utils/helpers'

// Adjust the rent due for a month (e.g. a discount or pro-rated first month) or edit notes.
export const PUT = route(async ({ request, params, user, audit }) => {
  const payment = await findPayment(user, params.id)
  const body = await readJson(request)
  const before = { rent: payment.rentAmount, notes: payment.notes }
  payment.set(pick(body, ['rentAmount', 'notes']))
  if (getTotalDue(payment) < payment.amountPaid) {
    throw new ApiError(400, `Total due cannot be less than the ₹${payment.amountPaid.toLocaleString('en-IN')} already paid.`)
  }
  await payment.save()
  if (before.rent !== payment.rentAmount || before.notes !== payment.notes) {
    await audit('dues.adjust', {
      target: await paymentTarget(payment),
      details: { month: payment.month, rentFrom: before.rent, rentTo: payment.rentAmount, notesChanged: before.notes !== payment.notes },
    })
  }
  return json(payment)
}, { permission: 'rent.adjust' })

// Removes a dues record created by mistake. Recorded payments must be removed first.
export const DELETE = route(async ({ params, user, audit }) => {
  const payment = await findPayment(user, params.id)
  if (payment.transactions.length > 0 || payment.amountPaid > 0) {
    throw new ApiError(409, 'This month has payments recorded. Remove those payments first.')
  }
  const target = await paymentTarget(payment)
  await payment.deleteOne()
  await audit('dues.delete', { target, details: { month: payment.month, rent: payment.rentAmount } })
  return json({ ok: true })
}, { permission: 'rent.adjust' })
