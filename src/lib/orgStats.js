// Account-level facts about owner organizations for the admin console (no business amounts).
import Property from './models/Property.js'
import Room from './models/Room.js'
import Membership from './models/Membership.js'

/** Owner accounts only — staff logins are users too, but not organizations. */
export const OWNER_ONLY = { kind: { $ne: 'staff' } }

/**
 * Per-organization property facts: { propertyCount, beds, firstProperty } keyed by org id.
 * Beds come from room capacities, or the property's manual bed count if it has no rooms yet.
 */
export async function propertyFacts(orgIds) {
  const filter = { status: 'active', ...(orgIds ? { orgId: { $in: orgIds } } : {}) }
  const properties = await Property.find(filter).sort({ createdAt: 1 }).select('orgId name address phone city totalBeds')
  const roomBeds = await Room.aggregate([
    { $match: { status: 'active', propertyId: { $in: properties.map(p => p._id) } } },
    { $group: { _id: '$propertyId', beds: { $sum: '$capacity' } } },
  ])
  const bedsByProperty = new Map(roomBeds.map(r => [r._id.toString(), r.beds]))
  const facts = new Map()
  for (const p of properties) {
    const key = p.orgId.toString()
    const entry = facts.get(key) ?? { propertyCount: 0, beds: 0, firstProperty: p }
    entry.propertyCount += 1
    entry.beds += bedsByProperty.get(p._id.toString()) ?? p.totalBeds ?? 0
    facts.set(key, entry)
  }
  return facts
}

export async function teamSize(orgId) {
  return Membership.countDocuments({ orgId, status: 'active' })
}
