import mongoose from 'mongoose'
import Notice from '@/lib/models/Notice'
import Tenant from '@/lib/models/Tenant'
import { route, readJson, json, ApiError } from '@/lib/api'
import { recordedBy } from '@/lib/paymentLookup'
import { notifyResident } from '@/lib/notify'

/** Notices that apply to properties this user can see. */
function visibleFilter(scope) {
  const filter = { orgId: scope.orgId, status: 'active' }
  if (scope.propertyIds) filter.$or = [{ propertyIds: { $size: 0 } }, { propertyIds: { $in: scope.propertyIds.map(id => new mongoose.Types.ObjectId(id)) } }]
  return filter
}

export const GET = route(async ({ scope }) => {
  const notices = await Notice.find(visibleFilter(scope)).sort({ pinned: -1, createdAt: -1 }).limit(200)
  return json(notices)
}, { permission: 'notices.view' })

// Publish a notice (L1: everyone in those properties sees it in the tenant app).
export const POST = route(async ({ request, org, scope, actor, audit }) => {
  const { title, body = '', propertyIds = [], pinned = false, requiresAck = false } = await readJson(request)
  if (typeof title !== 'string' || !title.trim()) throw new ApiError(400, 'Give the notice a title.')
  const ids = Array.isArray(propertyIds) ? [...new Set(propertyIds.map(String))] : []
  for (const id of ids) await scope.property(id) // must be a property this user can access
  if (!ids.length && scope.propertyIds) throw new ApiError(400, 'Choose which properties this notice is for.')

  const notice = await Notice.create({
    orgId: org._id, propertyIds: ids, title: title.trim(), body: String(body).trim(), pinned: !!pinned, requiresAck: !!requiresAck,
    createdBy: recordedBy(actor),
  })
  await audit('notice.published', { target: { kind: 'notice', id: notice._id.toString(), label: notice.title }, details: { properties: ids.length || 'all', requiresAck: notice.requiresAck } })

  // Tell residents who use the app.
  const tenants = await Tenant.find({ userId: org._id, status: 'active', residentId: { $ne: null }, ...(ids.length ? { propertyId: { $in: ids } } : {}) }).select('residentId')
  for (const t of tenants) {
    await notifyResident({ residentId: t.residentId, orgId: org._id, type: 'notice', title: `📢 ${notice.title}`, body: notice.body.slice(0, 200), link: '/t/home', key: `notice:${notice._id}:${t.residentId}` })
  }
  return json(notice, 201)
}, { permission: 'notices.manage' })
