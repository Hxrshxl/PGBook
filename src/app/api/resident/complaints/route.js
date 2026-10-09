import Complaint, { COMPLAINT_CATEGORIES } from '@/lib/models/Complaint'
import { readJson, json, ApiError } from '@/lib/api'
import { residentRoute } from '@/lib/residentApi'
import { attachUploads } from '@/lib/files'
import { notifyOrg } from '@/lib/notify'
import { complaintView } from '@/lib/residentData'

export const GET = residentRoute(async ({ tenant, org }) => {
  const list = await Complaint.find({ userId: org._id, tenantId: tenant._id }).sort({ createdAt: -1 }).limit(100)
  return json(list.map(complaintView))
})

// Raise a complaint from the app, with up to 3 photos and "OK to enter my room".
export const POST = residentRoute(async ({ request, tenant, org, audit }) => {
  const { category, description, urgent = false, okToEnter = false, photoIds = [] } = await readJson(request)
  if (!COMPLAINT_CATEGORIES.includes(category)) throw new ApiError(400, 'Choose what the problem is about.')
  if (typeof description !== 'string' || description.trim().length < 5) throw new ApiError(400, 'Describe the problem in a few words.')
  const open = await Complaint.countDocuments({ tenantId: tenant._id, status: { $ne: 'resolved' }, withdrawnAt: null })
  if (open >= 10) throw new ApiError(409, 'You already have 10 open complaints. Please wait for some to be resolved.')

  const complaint = new Complaint({
    userId: org._id, tenantId: tenant._id, propertyId: tenant.propertyId, tenantName: tenant.name, room: tenant.room,
    category, description: description.trim(), priority: urgent ? 'high' : 'medium', okToEnter: !!okToEnter,
    source: 'resident', residentId: tenant.residentId,
  })
  complaint.photoIds = await attachUploads(photoIds, { tenantId: tenant._id, kind: 'complaint', recordId: complaint._id, max: 3 })
  await complaint.save()
  await audit('complaint.create', { target: { kind: 'complaint', id: complaint._id.toString(), label: `${tenant.name} (Room ${tenant.room})` }, details: { category, priority: complaint.priority } })
  await notifyOrg({
    orgId: org._id, capability: 'complaints.manage', type: 'complaints.new', tone: urgent ? 'warning' : 'info', link: '/dashboard/complaints',
    title: `${urgent ? 'Urgent: ' : ''}${tenant.name} (Room ${tenant.room}) raised a complaint`,
    body: `${category}: ${complaint.description.slice(0, 160)}${complaint.photoIds.length ? ` · ${complaint.photoIds.length} photo(s)` : ''}`,
  })
  return json(complaintView(complaint), 201)
}, { write: true })
