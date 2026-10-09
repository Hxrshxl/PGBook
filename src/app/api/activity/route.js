import AuditEvent from '@/lib/models/AuditEvent'
import { route, json } from '@/lib/api'
import { cursorFilter, nextCursor } from '@/lib/cursor'

const LIMIT = 40

// Category filters for the owner's Activity page.
const CATEGORIES = {
  money: { action: /^(payment|dues|bill)\./ },
  tenants: { action: /^(tenant|complaint)\./ },
  security: { action: /^(auth|account|settings|org\.signup)/ },
  pgbook: { 'actor.realm': 'admin' },
}

// PGBook staff appear by role and first name; their IP and browser are not shown to owners.
function ownerView(event) {
  const json = event.toJSON()
  if (json.actor.realm === 'admin') {
    json.actor = { realm: 'admin', name: json.actor.name.split(' ')[0], role: json.actor.role }
    delete json.ip
    delete json.userAgent
  }
  return json
}

// Everything that happened in the owner's account — including anything PGBook staff
// did to it (suspensions, trial changes, forced sign-outs), shown with the reason.
export const GET = route(async ({ request, org }) => {
  const params = new URL(request.url).searchParams
  const category = CATEGORIES[params.get('category')] ?? {}
  const page = cursorFilter(params.get('cursor'))
  // Internal approval steps stay internal; the owner sees the outcome (e.g. org.suspended).
  const query = { $and: [{ orgId: org._id }, { action: { $not: /^approval\./ } }, category, page] }

  const docs = await AuditEvent.find(query).sort({ createdAt: -1, _id: -1 }).limit(LIMIT + 1)
  return json({ events: docs.slice(0, LIMIT).map(ownerView), nextCursor: nextCursor(docs, LIMIT) })
}, { permission: 'activity.view' })
