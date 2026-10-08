import CashCollection from '@/lib/models/CashCollection'
import Tenant from '@/lib/models/Tenant'
import { route, readJson, json, ApiError, APP_TIME_ZONE } from '@/lib/api'
import { findPayment, recordedBy } from '@/lib/paymentLookup'
import { can } from '@/lib/policy'
import { getBalance, roundMoney, todayISO } from '@/utils/helpers'

// Cash collections: caretakers see what they logged; confirmers see everything in their properties.
export const GET = route(async ({ request, scope, actor }) => {
  const status = new URL(request.url).searchParams.get('status')
  const filter = scope.filter(status ? { status } : {}, 'orgId')
  if (!can(actor, 'cash.confirm')) filter['collectedBy.id'] = actor.id
  const collections = await CashCollection.find(filter).sort({ createdAt: -1 }).limit(200)
  return json(collections)
}, { permission: 'rent.view' })

// A caretaker logs cash received from a tenant. It counts once someone confirms the handover.
export const POST = route(async ({ request, org, scope, actor, audit }) => {
  const { paymentId, amount, date, note } = await readJson(request)
  const payment = await findPayment(scope, paymentId)
  const value = roundMoney(amount)
  if (!(value > 0)) throw new ApiError(400, 'Amount must be greater than zero.')

  // Cash already waiting for confirmation counts against the balance too.
  const pending = await CashCollection.find({ orgId: org._id, paymentId: payment._id, status: 'pending' }).select('amount')
  const available = roundMoney(getBalance(payment) - pending.reduce((s, c) => s + c.amount, 0))
  if (value > available) {
    throw new ApiError(400, available > 0
      ? `Only ₹${available.toLocaleString('en-IN')} is still due (including cash waiting for confirmation).`
      : 'Nothing is due — this month is paid or the remaining cash is already waiting for confirmation.')
  }

  const tenant = await Tenant.findById(payment.tenantId).select('name room')
  const collection = await CashCollection.create({
    orgId: org._id,
    propertyId: payment.propertyId,
    paymentId: payment._id,
    tenantId: payment.tenantId,
    tenantName: tenant?.name ?? '',
    room: tenant?.room ?? '',
    month: payment.month,
    amount: value,
    date: date ?? todayISO(APP_TIME_ZONE),
    note: typeof note === 'string' ? note : '',
    collectedBy: recordedBy(actor),
  })
  await audit('cash.collected', {
    target: { kind: 'payment', id: payment._id.toString(), label: `${collection.tenantName} (Room ${collection.room})` },
    details: { amount: value, month: payment.month },
  })
  return json(collection, 201)
}, { permission: 'cash.collect' })
