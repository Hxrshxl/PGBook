import ApprovalRequest from '@/lib/models/ApprovalRequest'
import CashCollection from '@/lib/models/CashCollection'
import { route, json } from '@/lib/api'
import { approvalView, expireStaleApprovals } from '@/lib/approvals'
import { can } from '@/lib/policy'

// The organization's approvals inbox: staff requests (owner decides) and cash waiting for confirmation.
export const GET = route(async ({ org, scope, actor }) => {
  await expireStaleApprovals()
  const mine = { realm: 'org', orgId: org._id }
  const query = can(actor, 'approvals.decide') ? mine : { ...mine, 'requestedBy.id': actor.id }
  const requests = (await ApprovalRequest.find(query).sort({ createdAt: -1 }).limit(100)).map(a => approvalView(a, actor))

  const cashFilter = scope.filter({}, 'orgId')
  if (!can(actor, 'cash.confirm')) cashFilter['collectedBy.id'] = actor.id
  const cash = await CashCollection.find(cashFilter).sort({ createdAt: -1 }).limit(100)

  const pendingCash = cash.filter(c => c.status === 'pending')
  return json({
    requests,
    cash,
    counts: {
      requests: requests.filter(r => r.canDecide).length,
      cash: can(actor, 'cash.confirm') ? pendingCash.filter(c => String(c.collectedBy.id) !== String(actor.id)).length : 0,
      pendingCashAmount: pendingCash.reduce((s, c) => s + c.amount, 0),
    },
  })
}, { permission: 'approvals.view' })
