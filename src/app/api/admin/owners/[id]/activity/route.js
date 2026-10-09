import AuditEvent from '@/lib/models/AuditEvent'
import { json } from '@/lib/api'
import { adminRoute } from '@/lib/adminApi'
import { findOrg } from '@/lib/orgAdmin'
import { redactForAdmin } from '@/lib/audit'
import { cursorFilter, nextCursor } from '@/lib/cursor'

const LIMIT = 30

// The owner's activity as PGBook staff may see it: what and when, but business
// events are redacted (no amounts, no tenant names).
export const GET = adminRoute(async ({ request, params }) => {
  const user = await findOrg(params.id)
  const cursor = new URL(request.url).searchParams.get('cursor')
  const docs = await AuditEvent.find({ orgId: user._id, ...cursorFilter(cursor) })
    .sort({ createdAt: -1, _id: -1 }).limit(LIMIT + 1)
  return json({ events: docs.slice(0, LIMIT).map(redactForAdmin), nextCursor: nextCursor(docs, LIMIT) })
}, { permission: 'orgs.view' })
