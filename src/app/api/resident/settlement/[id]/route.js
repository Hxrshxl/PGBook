import DepositSettlement from '@/lib/models/DepositSettlement'
import { readJson, json, ApiError, assertObjectId } from '@/lib/api'
import { residentRoute } from '@/lib/residentApi'
import { notifyOrg } from '@/lib/notify'
import { settlementView } from '@/lib/residentData'
import { formatCurrency } from '@/utils/helpers'

// Accept the settlement, or dispute it with a comment (it stays open; PGBook does not arbitrate).
export const POST = residentRoute(async ({ request, params, tenant, org, audit }) => {
  assertObjectId(params.id, 'Settlement')
  const { action, comment = '' } = await readJson(request)
  if (!['accept', 'dispute'].includes(action)) throw new ApiError(400, 'Unknown action.')
  const text = String(comment).trim()
  if (action === 'dispute' && text.length < 5) throw new ApiError(400, 'Please explain what you disagree with.')
  const s = await DepositSettlement.findOne({ _id: params.id, tenantId: tenant._id, status: { $in: ['shared', 'disputed'] } })
  if (!s) throw new ApiError(409, 'This settlement is not waiting for your response.')

  s.status = action === 'accept' ? 'accepted' : 'disputed'
  s.tenantResponse = { status: s.status, comment: text.slice(0, 1000), at: new Date() }
  await s.save()
  await audit(action === 'accept' ? 'settlement.accepted' : 'settlement.disputed', {
    target: { kind: 'tenant', id: tenant._id.toString(), label: tenant.name }, reason: text, details: { refund: s.refundAmount },
  })
  await notifyOrg({
    orgId: org._id, capability: 'deposits.view', type: `settlement.${s.status}`, tone: action === 'accept' ? 'success' : 'warning', link: '/dashboard/deposits',
    title: action === 'accept' ? `${tenant.name} accepted the deposit settlement` : `${tenant.name} disputed the deposit settlement`,
    body: action === 'accept' ? `Refund ${formatCurrency(Math.max(0, s.refundAmount))}. Record the refund in Deposits when you pay it.` : `“${text.slice(0, 200)}”`,
  })
  return json(settlementView(s))
})
