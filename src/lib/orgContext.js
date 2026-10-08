// Who is acting, for which organization, and on which properties.
// Every owner-facing API request resolves this once (see route() in api.js).
import mongoose from 'mongoose'
import User from './models/User.js'
import Membership from './models/Membership.js'
import Property from './models/Property.js'
import Room from './models/Room.js'
import Tenant from './models/Tenant.js'
import Payment from './models/Payment.js'
import UtilityBill from './models/UtilityBill.js'
import Complaint from './models/Complaint.js'
import { ApiError } from './api.js'

export const CURRENT_ORG_VERSION = 1

/**
 * Returns { org, role, membership, propertyIds } for a signed-in user, or null
 * if they no longer have access (staff removed, organization suspended).
 * propertyIds === null means "all properties".
 */
export async function resolveOrgContext(user) {
  let org = user
  let role = 'owner'
  let membership = null
  let propertyIds = null

  if (user.kind === 'staff') {
    membership = await Membership.findOne({ userId: user._id, status: 'active' })
    if (!membership) return null
    org = await User.findById(membership.orgId)
    if (!org || org.kind === 'staff' || org.status === 'suspended') return null
    role = membership.role
    propertyIds = membership.propertyIds?.length ? membership.propertyIds.map(String) : null
  }

  await ensureOrgMigrated(org)
  return { org, role, membership, propertyIds }
}

/**
 * Query helpers bound to the request's organization and property access.
 * Older models store the organization as `userId`; newer ones as `orgId`.
 */
export function makeScope({ org, propertyIds }) {
  const orgId = org._id
  const allowed = propertyIds ? new Set(propertyIds) : null
  return {
    orgId,
    propertyIds,
    filter(extra = {}, orgField = 'userId') {
      const base = { [orgField]: orgId }
      if (propertyIds) base.propertyId = { $in: propertyIds.map(id => new mongoose.Types.ObjectId(id)) }
      return { ...base, ...extra }
    },
    /** Query for Property documents themselves (they are identified by _id, not propertyId). */
    propertyQuery(extra = {}) {
      const base = { orgId }
      if (propertyIds) base._id = { $in: propertyIds.map(id => new mongoose.Types.ObjectId(id)) }
      return { ...base, ...extra }
    },
    canAccessProperty(propertyId) {
      return !allowed || (propertyId && allowed.has(String(propertyId)))
    },
    /** Loads an active property of this organization the actor may access, or throws 404. */
    async property(propertyId) {
      if (!mongoose.isValidObjectId(propertyId)) throw new ApiError(400, 'Please choose a property.')
      if (!this.canAccessProperty(propertyId)) throw new ApiError(404, 'Property not found.')
      const property = await Property.findOne({ _id: propertyId, orgId, status: 'active' })
      if (!property) throw new ApiError(404, 'Property not found.')
      return property
    },
    /** The property to use when the client didn't say: the only one the actor can access, or an error. */
    async defaultProperty(propertyId) {
      if (propertyId) return this.property(propertyId)
      const query = { orgId, status: 'active' }
      if (propertyIds) query._id = { $in: propertyIds.map(id => new mongoose.Types.ObjectId(id)) }
      const properties = await Property.find(query).sort({ createdAt: 1 }).limit(2)
      if (properties.length === 1) return properties[0]
      if (properties.length === 0) throw new ApiError(409, 'Add a property first.')
      throw new ApiError(400, 'You have more than one property — please choose which one.')
    },
  }
}

const sleep = ms => new Promise(r => setTimeout(r, ms))

/**
 * One-time upgrade of an organization created before properties existed:
 *  • its PG settings become its first Property,
 *  • rooms are created from the room names its tenants already use,
 *  • tenants, dues, bills and complaints are linked to that property.
 * Safe to call on every request: it only runs once, and concurrent requests wait for it.
 */
export async function ensureOrgMigrated(org) {
  if ((org.orgVersion ?? 0) >= CURRENT_ORG_VERSION) return

  const claimed = await User.updateOne(
    {
      _id: org._id,
      $and: [
        // Accounts created before this field existed don't have it at all ($lt alone wouldn't match them).
        { $or: [{ orgVersion: { $exists: false } }, { orgVersion: { $lt: CURRENT_ORG_VERSION } }] },
        { $or: [{ migratingAt: null }, { migratingAt: { $lt: new Date(Date.now() - 60000) } }] },
      ],
    },
    { $set: { migratingAt: new Date() } },
  )
  if (claimed.modifiedCount === 0) {
    // Someone else is migrating this organization; wait for them.
    for (let i = 0; i < 50; i++) {
      await sleep(100)
      const fresh = await User.findById(org._id).select('orgVersion')
      if ((fresh?.orgVersion ?? 0) >= CURRENT_ORG_VERSION) { org.orgVersion = fresh.orgVersion; return }
    }
    throw new ApiError(503, 'Your account is being upgraded. Please try again in a moment.')
  }

  try {
    const pg = org.pgSettings ?? {}
    let property = await Property.findOne({ orgId: org._id }).sort({ createdAt: 1 })
    if (!property) {
      property = await Property.create({
        orgId: org._id,
        name: pg.pgName || `${org.name}'s PG`,
        address: pg.address ?? '',
        phone: pg.phone ?? '',
        ownerName: pg.ownerName || org.name,
        upiId: pg.upiId ?? '',
        logoText: pg.logoText ?? '',
        totalBeds: pg.totalBeds ?? 0,
        rentDueDay: pg.rentDueDay ?? 5,
      })
    }

    // Rooms from the room names tenants already use. Capacity = active tenants in it (at least 1).
    const tenants = await Tenant.find({ userId: org._id }).select('room rentAmount status roomId propertyId')
    const byRoom = new Map()
    for (const t of tenants) {
      const name = (t.room ?? '').trim()
      if (!name) continue
      const entry = byRoom.get(name) ?? { active: 0, rents: [] }
      if (t.status === 'active') entry.active += 1
      entry.rents.push(t.rentAmount)
      byRoom.set(name, entry)
    }
    const existing = new Map((await Room.find({ propertyId: property._id })).map(r => [r.name, r]))
    for (const [name, info] of byRoom) {
      if (existing.has(name)) continue
      const counts = new Map()
      for (const r of info.rents) counts.set(r, (counts.get(r) ?? 0) + 1)
      const commonRent = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0
      existing.set(name, await Room.create({
        orgId: org._id, propertyId: property._id, name: name.slice(0, 20), capacity: Math.min(20, Math.max(1, info.active)), rent: commonRent,
      }))
    }

    const tenantUpdates = tenants
      .filter(t => !t.propertyId || !t.roomId)
      .map(t => ({
        updateOne: {
          filter: { _id: t._id },
          update: { $set: { propertyId: t.propertyId ?? property._id, roomId: t.roomId ?? existing.get((t.room ?? '').trim())?._id ?? null } },
        },
      }))
    if (tenantUpdates.length) await Tenant.bulkWrite(tenantUpdates)

    const unassigned = { userId: org._id, $or: [{ propertyId: null }, { propertyId: { $exists: false } }] }
    await Promise.all([
      Payment.updateMany(unassigned, { $set: { propertyId: property._id } }),
      UtilityBill.updateMany(unassigned, { $set: { propertyId: property._id } }),
      Complaint.updateMany(unassigned, { $set: { propertyId: property._id } }),
    ])

    await User.updateOne({ _id: org._id }, { $set: { orgVersion: CURRENT_ORG_VERSION, migratingAt: null } })
    org.orgVersion = CURRENT_ORG_VERSION
  } catch (err) {
    await User.updateOne({ _id: org._id }, { $set: { migratingAt: null } })
    throw err
  }
}
