import Complaint from '@/lib/models/Complaint'
import Tenant from '@/lib/models/Tenant'
import { route, readJson, json, pick, assertObjectId, ApiError } from '@/lib/api'
import { complaintTarget } from '@/lib/auditTargets'

export const GET = route(async ({ user }) => {
  const complaints = await Complaint.find({ userId: user._id }).sort({ createdAt: -1 })
  return json(complaints)
}, { permission: 'complaints.view' })

export const POST = route(async ({ request, user, audit }) => {
  const body = await readJson(request)
  assertObjectId(body.tenantId, 'Tenant')
  const tenant = await Tenant.findOne({ _id: body.tenantId, userId: user._id })
  if (!tenant) throw new ApiError(404, 'Tenant not found.')

  const complaint = await Complaint.create({
    ...pick(body, ['category', 'priority', 'description']),
    userId: user._id,
    tenantId: tenant._id,
    tenantName: tenant.name,
    room: tenant.room,
  })
  await audit('complaint.create', { target: complaintTarget(complaint), details: { category: complaint.category, priority: complaint.priority } })
  return json(complaint, 201)
}, { permission: 'complaints.manage' })
