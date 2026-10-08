import ApprovalRequest from '@/lib/models/ApprovalRequest'
import { json } from '@/lib/api'
import { adminRoute } from '@/lib/adminApi'
import { approvalView, expireStaleApprovals } from '@/lib/approvals'

// view=waiting (I can decide) | raised (I asked) | history (everything, newest first)
export const GET = adminRoute(async ({ request, actor }) => {
  await expireStaleApprovals()
  const view = new URL(request.url).searchParams.get('view') ?? 'waiting'

  const pending = (await ApprovalRequest.find({ status: 'pending' }).sort({ createdAt: 1 })).map(a => approvalView(a, actor))
  const waiting = pending.filter(a => a.canDecide)
  let items
  if (view === 'raised') {
    items = (await ApprovalRequest.find({ 'requestedBy.id': actor.id }).sort({ createdAt: -1 }).limit(100)).map(a => approvalView(a, actor))
  } else if (view === 'history') {
    items = (await ApprovalRequest.find({}).sort({ createdAt: -1 }).limit(100)).map(a => approvalView(a, actor))
  } else {
    items = waiting
  }
  return json({ items, counts: { waiting: waiting.length, pending: pending.length } })
}, { permission: 'approvals.view' })
