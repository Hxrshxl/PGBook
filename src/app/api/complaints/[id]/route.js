import Complaint from '@/lib/models/Complaint'
import { route, readJson, json, pick, assertObjectId, ApiError } from '@/lib/api'
import { complaintTarget } from '@/lib/auditTargets'

async function findComplaint(user, id) {
  assertObjectId(id, 'Complaint')
  const complaint = await Complaint.findOne({ _id: id, userId: user._id })
  if (!complaint) throw new ApiError(404, 'Complaint not found.')
  return complaint
}

// Update status, priority or owner notes.
export const PATCH = route(async ({ request, params, user, audit }) => {
  const complaint = await findComplaint(user, params.id)
  const body = await readJson(request)
  const previousStatus = complaint.status
  complaint.set(pick(body, ['status', 'priority', 'ownerNotes', 'category']))
  const fields = complaint.directModifiedPaths()
  if (complaint.status !== previousStatus) {
    complaint.resolvedAt = complaint.status === 'resolved' ? new Date() : null
  }
  await complaint.save()
  if (fields.length) {
    await audit('complaint.update', {
      target: complaintTarget(complaint),
      details: { fields, ...(complaint.status !== previousStatus ? { statusFrom: previousStatus, statusTo: complaint.status } : {}) },
    })
  }
  return json(complaint)
}, { permission: 'complaints.manage' })

export const DELETE = route(async ({ params, user, audit }) => {
  const complaint = await findComplaint(user, params.id)
  await complaint.deleteOne()
  await audit('complaint.delete', { target: complaintTarget(complaint), details: { category: complaint.category, status: complaint.status } })
  return json({ ok: true })
}, { permission: 'complaints.manage' })
