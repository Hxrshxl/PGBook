import CashCollection from '@/lib/models/CashCollection'
import { route, readJson, json, assertObjectId, ApiError } from '@/lib/api'
import { findPayment, recordedBy } from '@/lib/paymentLookup'
import { getBalance } from '@/utils/helpers'

// Confirm (the cash was handed over → it becomes a payment) or reject a cash collection.
export const POST = route(async ({ request, params, scope, actor, audit }) => {
  assertObjectId(params.id, 'Collection')
  const collection = await CashCollection.findOne({ _id: params.id, ...scope.filter({}, 'orgId') })
  if (!collection) throw new ApiError(404, 'Collection not found.')
  if (collection.status !== 'pending') throw new ApiError(409, `This collection was already ${collection.status}.`)
  if (String(collection.collectedBy.id) === String(actor.id)) throw new ApiError(403, "You can't confirm cash you collected yourself.")

  const { decision, note } = await readJson(request)
  if (!['confirm', 'reject'].includes(decision)) throw new ApiError(400, 'Decision must be confirm or reject.')
  if (decision === 'reject' && String(note ?? '').trim().length < 3) throw new ApiError(400, 'Please say why (e.g. amount short at handover).')

  const target = { kind: 'payment', id: collection.paymentId.toString(), label: `${collection.tenantName} (Room ${collection.room})` }
  let payment = null
  if (decision === 'confirm') {
    payment = await findPayment(scope, collection.paymentId)
    if (collection.amount > getBalance(payment)) {
      throw new ApiError(409, `The month's balance is now ₹${getBalance(payment).toLocaleString('en-IN')}, less than this collection. Check for a duplicate entry, then reject this one.`)
    }
    payment.transactions.push({
      amount: collection.amount,
      date: collection.date,
      method: 'cash',
      note: `Collected by ${collection.collectedBy.name}${collection.note ? ` · ${collection.note}` : ''}`,
      recordedBy: collection.collectedBy,
    })
    await payment.save()
  }

  collection.status = decision === 'confirm' ? 'confirmed' : 'rejected'
  collection.decidedBy = recordedBy(actor)
  collection.decidedAt = new Date()
  collection.decisionNote = String(note ?? '').trim()
  await collection.save()
  await audit(decision === 'confirm' ? 'cash.confirmed' : 'cash.rejected', {
    target, reason: collection.decisionNote,
    details: { amount: collection.amount, month: collection.month, collectedBy: collection.collectedBy.name },
  })
  return json({ collection, payment })
}, { permission: 'cash.confirm' })
