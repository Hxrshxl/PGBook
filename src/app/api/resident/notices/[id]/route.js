import Notice from '@/lib/models/Notice'
import { json, ApiError, assertObjectId } from '@/lib/api'
import { residentRoute } from '@/lib/residentApi'
import { noticeFilter, noticeView } from '@/lib/residentData'

// "I've read this" for notices that ask for an acknowledgement.
export const POST = residentRoute(async ({ params, tenant }) => {
  assertObjectId(params.id, 'Notice')
  const notice = await Notice.findOne({ _id: params.id, ...noticeFilter(tenant) })
  if (!notice) throw new ApiError(404, 'Notice not found.')
  if (!notice.acks.some(a => String(a.tenantId) === String(tenant._id))) {
    notice.acks.push({ tenantId: tenant._id, name: tenant.name, at: new Date() })
    await notice.save()
  }
  return json(noticeView(notice, tenant._id))
})
