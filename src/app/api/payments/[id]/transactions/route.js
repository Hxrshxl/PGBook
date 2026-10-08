import { route, readJson, json, ApiError, APP_TIME_ZONE } from '@/lib/api'
import { findPayment } from '@/lib/paymentLookup'
import { paymentTarget } from '@/lib/auditTargets'
import { getBalance, roundMoney, todayISO } from '@/utils/helpers'

// Records money received against a month's dues.
export const POST = route(async ({ request, params, user, audit }) => {
  const payment = await findPayment(user, params.id)
  const { amount, date, method, note } = await readJson(request)

  const value = roundMoney(amount)
  if (!Number.isFinite(Number(amount)) || value <= 0) {
    throw new ApiError(400, 'Amount must be greater than zero.')
  }

  // Dues recorded before transaction history existed: keep that amount as an opening entry.
  if (payment.transactions.length === 0 && payment.amountPaid > 0) {
    payment.transactions.push({
      amount: payment.amountPaid,
      date: payment.paidDate ?? todayISO(APP_TIME_ZONE),
      method: 'other',
      note: 'Recorded before payment history',
    })
  }

  const balance = getBalance(payment)
  if (value > balance) {
    throw new ApiError(400, `Amount is more than the balance due (₹${balance.toLocaleString('en-IN')}). Adjust the due amount first if needed.`)
  }

  payment.transactions.push({
    amount: value,
    date: date ?? todayISO(APP_TIME_ZONE),
    method: method ?? 'upi',
    note: typeof note === 'string' ? note : '',
  })
  await payment.save()
  const entry = payment.transactions[payment.transactions.length - 1]
  await audit('payment.record', {
    target: await paymentTarget(payment),
    details: { month: payment.month, amount: entry.amount, method: entry.method, date: entry.date, status: payment.status },
  })
  return json(payment, 201)
}, { permission: 'rent.record' })
