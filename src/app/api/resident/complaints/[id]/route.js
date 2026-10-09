import Complaint from '@/lib/models/Complaint'
import { readJson, json, ApiError, assertObjectId } from '@/lib/api'
import { residentRoute } from '@/lib/residentApi'
import { notifyOrg } from '@/lib/notify'
import { complaintView } from '@/lib/residentData'

const DAY = 86400000

// confirm — "it's fixed" (closes it) · reopen — within 7 days of being resolved · withdraw — while still open
export const POST = residentRoute(async ({ request, params, tenant, org, audit }) => {
  assertObjectId(params.id, 'Complaint')
  const { action } = await readJson(request)
  const complaint = await Complaint.findOne({ _id: params.id, userId: org._id, tenantId: tenant._id })
  if (!complaint) throw new ApiError(404, 'Complaint not found.')
  const target = { kind: 'complaint', id: complaint._id.toString(), label: `${tenant.name} (Room ${tenant.room})` }
  const now = new Date()

  if (action === 'confirm') {
    if (complaint.status !== 'resolved' || complaint.closedAt) throw new ApiError(409, 'This complaint is not waiting for your confirmation.')
    complaint.closedAt = now
    complaint.closedBy = 'resident'
  } else if (action === 'reopen') {
    if (complaint.status !== 'resolved' || complaint.withdrawnAt) throw new ApiError(409, 'Only resolved complaints can be reopened.')
    if (!complaint.resolvedAt || now - complaint.resolvedAt > 7 * DAY) throw new ApiError(409, 'Complaints can be reopened within 7 days. Please raise a new one.')
    complaint.status = 'open'
    complaint.resolvedAt = null
    complaint.closedAt = null
    complaint.closedBy = null
    complaint.reopenCount = (complaint.reopenCount ?? 0) + 1
    await notifyOrg({
      orgId: org._id, capability: 'complaints.manage', type: 'complaints.reopened', tone: 'warning', link: '/dashboard/complaints',
      title: `${tenant.name} (Room ${tenant.room}) says a complaint is not fixed`, body: complaint.description.slice(0, 160),
    })
  } else if (action === 'withdraw') {
    if (complaint.status !== 'open' || complaint.withdrawnAt) throw new ApiError(409, 'Work has started on this complaint, so it can no longer be withdrawn.')
    complaint.status = 'resolved'
    complaint.resolvedAt = now
    complaint.withdrawnAt = now
    complaint.closedAt = now
    complaint.closedBy = 'resident'
  } else {
    throw new ApiError(400, 'Unknown action.')
  }
  await complaint.save()
  await audit('complaint.update', { target, details: { statusTo: action === 'reopen' ? 'open' : action === 'withdraw' ? 'withdrawn' : 'closed', byTenant: true } })
  return json(complaintView(complaint))
})
