import { route, readJson, json } from '@/lib/api'
import { approvalView, cancelApproval, decideApproval } from '@/lib/approvals'

// The owner approves or rejects a staff request (realm and organization are checked in decideApproval).
export const POST = route(async ({ request, params, actor }) => {
  const { decision, note } = await readJson(request)
  const { approval, result } = await decideApproval({ id: params.id, decision, note, actor, request })
  return json({ approval: approvalView(approval, actor), result })
}, { permission: 'approvals.decide' })

// The staff member withdraws their own pending request.
export const DELETE = route(async ({ request, params, actor }) => {
  const approval = await cancelApproval({ id: params.id, actor, request })
  return json({ approval: approvalView(approval, actor) })
}, { permission: 'approvals.view' })
