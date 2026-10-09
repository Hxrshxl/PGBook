import Notice from '@/lib/models/Notice'
import { json } from '@/lib/api'
import { residentRoute } from '@/lib/residentApi'
import { noticeFilter, noticeView } from '@/lib/residentData'

export const GET = residentRoute(async ({ tenant }) => {
  const list = await Notice.find(noticeFilter(tenant)).sort({ pinned: -1, createdAt: -1 }).limit(50)
  return json(list.map(n => noticeView(n, tenant._id)))
})
