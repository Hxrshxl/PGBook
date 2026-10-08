import AuditEvent from './models/AuditEvent.js'
import { ADMIN_ROLES } from './policy.js'

export function orgActor(user, role = 'owner') {
  return { realm: 'org', id: user._id, name: user.name, role }
}

export function adminActor(admin) {
  return { realm: 'admin', id: admin._id, name: admin.name, role: admin.role }
}

export const SYSTEM_ACTOR = { realm: 'system', id: null, name: 'PGBook system', role: 'system' }

export function requestInfo(request) {
  if (!request) return { ip: '', userAgent: '' }
  const forwarded = request.headers.get('x-forwarded-for')
  return {
    ip: forwarded?.split(',')[0].trim() || request.headers.get('x-real-ip') || '',
    userAgent: (request.headers.get('user-agent') ?? '').slice(0, 300),
  }
}

/**
 * Records an audit event. With critical: true a failure aborts the caller —
 * used for admin actions, which must never happen without a record.
 * Owner actions are best-effort so a logging hiccup never blocks rent collection.
 */
export async function recordAudit({ actor, action, orgId = null, target, reason = '', details, request }, { critical = false } = {}) {
  try {
    return await AuditEvent.create({ actor, action, orgId, target, reason, details, ...requestInfo(request) })
  } catch (err) {
    if (critical) throw err
    console.error('[audit] could not record', action, err)
    return null
  }
}

// Business data inside an owner's account: tenants, money, complaints.
const BUSINESS_PREFIXES = ['tenant.', 'dues.', 'payment.', 'bill.', 'complaint.']

export function isBusinessEvent(action) {
  return BUSINESS_PREFIXES.some(p => action.startsWith(p))
}

/**
 * What PGBook staff may see of an event: owners' business events show what
 * happened and when — never amounts or tenant names (see the design doc, §6.2).
 */
export function redactForAdmin(event) {
  const json = typeof event.toJSON === 'function' ? event.toJSON() : { ...event }
  if (json.actor?.realm !== 'admin' && isBusinessEvent(json.action)) {
    json.target = json.target ? { kind: json.target.kind } : undefined
    json.details = undefined
    json.redacted = true
  }
  // Admins need to know the payout UPI ID changed (fraud signal), not what it is.
  if (json.action === 'settings.payout_upi_changed') {
    json.details = undefined
    json.redacted = true
  }
  return json
}

export function actorLabel(actor) {
  if (!actor) return 'Unknown'
  if (actor.realm === 'admin') return `${actor.name} (${ADMIN_ROLES[actor.role] ?? actor.role})`
  if (actor.realm === 'system') return 'PGBook system'
  return actor.name || 'Unknown'
}
