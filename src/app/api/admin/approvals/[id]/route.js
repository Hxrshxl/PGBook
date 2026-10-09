import { readJson, json } from '@/lib/api'
import { adminRoute } from '@/lib/adminApi'
import { approvalView, cancelApproval, decideApproval } from '@/lib/approvals'

// Approve or reject. Needs a fresh 2FA code: approvals are the platform's most powerful action.
export const POST = adminRoute(async ({ request, params, actor }) => {
  const { decision, note } = await readJson(request)
  const { approval, result } = await decideApproval({ id: params.id, decision, note, actor, request })
  return json({ approval: approvalView(approval, actor), result })
}, { permission: 'approvals.view', stepUp: true })

// The requester withdraws their own pending request.
export const DELETE = adminRoute(async ({ request, params, actor }) => {
  const approval = await cancelApproval({ id: params.id, actor, request })
  return json({ approval: approvalView(approval, actor) })
}, { permission: 'approvals.view' })
