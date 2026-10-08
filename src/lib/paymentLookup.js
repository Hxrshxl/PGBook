import Payment from './models/Payment.js'
import { ApiError, assertObjectId } from './api'

export async function findPayment(user, id) {
  assertObjectId(id, 'Payment')
  const payment = await Payment.findOne({ _id: id, userId: user._id })
  if (!payment) throw new ApiError(404, 'Payment not found.')
  return payment
}
