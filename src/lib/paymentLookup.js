import Payment from './models/Payment.js'
import { ApiError, assertObjectId } from './api'

/** Loads a dues record the signed-in user may access (their organization and properties). */
export async function findPayment(scope, id) {
  assertObjectId(id, 'Payment')
  const payment = await Payment.findOne({ _id: id, ...scope.filter() })
  if (!payment) throw new ApiError(404, 'Payment not found.')
  return payment
}

/** Who recorded something, stored on payment entries and expenses. */
export const recordedBy = actor => ({ id: actor.id, name: actor.name, role: actor.role })
