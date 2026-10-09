import AuditEvent from '@/lib/models/AuditEvent'
import { json } from '@/lib/api'
import { adminRoute } from '@/lib/adminApi'
import { redactForAdmin } from '@/lib/audit'
import { auditFilter } from '@/lib/auditQuery'
import { cursorFilter, nextCursor } from '@/lib/cursor'

const LIMIT = 50

export const GET = adminRoute(async ({ request }) => {
  const params = new URL(request.url).searchParams
  const filter = auditFilter(params)
  const page = cursorFilter(params.get('cursor'))
  const query = Object.keys(page).length ? { $and: [filter, page] } : filter
  const docs = await AuditEvent.find(query).sort({ createdAt: -1, _id: -1 }).limit(LIMIT + 1)
  return json({ events: docs.slice(0, LIMIT).map(redactForAdmin), nextCursor: nextCursor(docs, LIMIT) })
}, { permission: 'audit.view' })
