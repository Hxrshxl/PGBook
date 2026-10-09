import Notice from '@/lib/models/Notice'
import { route, readJson, json, ApiError, assertObjectId, pick } from '@/lib/api'

async function findNotice(scope, id) {
  assertObjectId(id, 'Notice')
  const notice = await Notice.findOne({ _id: id, orgId: scope.orgId, status: 'active' })
  if (!notice) throw new ApiError(404, 'Notice not found.')
  // Staff limited to some properties can only change notices for those properties.
  if (scope.propertyIds && (!notice.propertyIds.length || notice.propertyIds.some(p => !scope.canAccessProperty(p)))) {
    throw new ApiError(403, 'This notice also covers properties you do not manage.')
  }
  return notice
}

export const PUT = route(async ({ request, params, scope, audit }) => {
  const notice = await findNotice(scope, params.id)
  const body = await readJson(request)
  notice.set(pick(body, ['title', 'body', 'pinned', 'requiresAck']))
  await notice.save()
  await audit('notice.updated', { target: { kind: 'notice', id: notice._id.toString(), label: notice.title } })
  return json(notice)
}, { permission: 'notices.manage' })

// Take a notice down (kept for the record, hidden from residents).
export const DELETE = route(async ({ params, scope, audit }) => {
  const notice = await findNotice(scope, params.id)
  notice.status = 'archived'
  await notice.save()
  await audit('notice.archived', { target: { kind: 'notice', id: notice._id.toString(), label: notice.title } })
  return json({ ok: true })
}, { permission: 'notices.manage' })
