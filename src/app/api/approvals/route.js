import ApprovalRequest from '@/lib/models/ApprovalRequest'
import CashCollection from '@/lib/models/CashCollection'
import PaymentClaim from '@/lib/models/PaymentClaim'
import MoveOutRequest from '@/lib/models/MoveOutRequest'
import DepositSettlement from '@/lib/models/DepositSettlement'
import { route, json } from '@/lib/api'
import { approvalView, expireStaleApprovals } from '@/lib/approvals'
import { can } from '@/lib/policy'

// The organization's approvals inbox: staff requests (owner decides), cash waiting for
// confirmation, tenants' payment reports, move-out notices and deposit settlements to approve.
export const GET = route(async ({ org, scope, actor }) => {
  await expireStaleApprovals()
  const mine = { realm: 'org', orgId: org._id }
  const query = can(actor, 'approvals.decide') ? mine : { ...mine, 'requestedBy.id': actor.id }
  const requests = (await ApprovalRequest.find(query).sort({ createdAt: -1 }).limit(100)).map(a => approvalView(a, actor))

  const cashFilter = scope.filter({}, 'orgId')
  if (!can(actor, 'cash.confirm')) cashFilter['collectedBy.id'] = actor.id
  const cash = await CashCollection.find(cashFilter).sort({ createdAt: -1 }).limit(100)

  const recent = new Date(Date.now() - 60 * 86400000)
  const [claims, moveOuts, settlements] = await Promise.all([
    can(actor, 'claims.review')
      ? PaymentClaim.find(scope.filter({ $or: [{ status: 'pending' }, { decidedAt: { $gte: recent } }] }, 'orgId')).sort({ createdAt: -1 }).limit(100)
      : [],
    can(actor, 'tenants.manage')
      ? MoveOutRequest.find(scope.filter({ $or: [{ status: 'pending' }, { decidedAt: { $gte: recent } }] }, 'orgId')).sort({ createdAt: -1 }).limit(100)
      : [],
    can(actor, 'deposits.approve')
      ? DepositSettlement.find(scope.filter({ status: 'pending_approval' }, 'orgId')).sort({ updatedAt: -1 }).limit(50)
      : [],
  ])

  const pendingCash = cash.filter(c => c.status === 'pending')
  return json({
    requests,
    cash,
    claims,
    moveOuts,
    settlements,
    counts: {
      requests: requests.filter(r => r.canDecide).length,
      cash: can(actor, 'cash.confirm') ? pendingCash.filter(c => String(c.collectedBy.id) !== String(actor.id)).length : 0,
      pendingCashAmount: pendingCash.reduce((s, c) => s + c.amount, 0),
      claims: claims.filter(c => c.status === 'pending').length,
      moveOuts: moveOuts.filter(m => m.status === 'pending').length,
      settlements: settlements.length,
    },
  })
}, { permission: 'approvals.view' })
