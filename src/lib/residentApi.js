// Route wrapper for the tenant app (/api/resident/*): its own realm and cookie,
// and every request is about one stay (Tenant record) the resident owns.
import mongoose from 'mongoose'
import dbConnect from './db'
import Resident from './models/Resident'
import Tenant from './models/Tenant'
import Property from './models/Property'
import User from './models/User'
import { RESIDENT_COOKIE, clearResidentCookie, verifyResidentToken } from './auth'
import { ApiError, assertSameOrigin, errorResponse, json } from './api'
import { recordAudit } from './audit'
import { billingState } from './subscription'

const SEEN_WRITE_INTERVAL_MS = 5 * 60 * 1000

export async function authenticateResident(request) {
  const session = await verifyResidentToken(request.cookies?.get(RESIDENT_COOKIE)?.value)
  if (!session || !mongoose.isValidObjectId(session.id)) return null
  const resident = await Resident.findById(session.id)
  if (!resident || resident.status !== 'active' || (resident.tokenVersion ?? 0) !== session.tokenVersion) return null
  if (!resident.lastSeenAt || Date.now() - resident.lastSeenAt.getTime() > SEEN_WRITE_INTERVAL_MS) {
    resident.lastSeenAt = new Date()
    await Resident.updateOne({ _id: resident._id }, { $set: { lastSeenAt: resident.lastSeenAt } })
  }
  return resident
}

/**
 * How much a resident may do with a stay:
 *  'full' — living there, and the PG's account is active
 *  'read' — moved out, PG account read-only or suspended: dues, receipts and settlement only
 */
export function stayAccess(tenant, org) {
  if (!org || org.status === 'suspended') return { access: 'read', reason: 'This PG is not using PGBook right now. You can still see your payments and receipts.' }
  if (tenant.status !== 'active') return { access: 'read', reason: 'You have moved out of this PG, so you can only view your payments, receipts and deposit settlement.' }
  if (billingState(org).readOnly) return { access: 'read', reason: "This PG's PGBook account is paused, so new requests can't be sent through the app right now. Please contact your PG directly." }
  return { access: 'full', reason: null }
}

/**
 * Options:
 *   auth  — require a signed-in resident (default true)
 *   stay  — the request is about one stay, given as ?tenancy=<id> or the X-Tenancy header (default true)
 *   write — the action changes something, so the stay must have full access (default false)
 * The handler receives { request, params, resident, tenant, org, property, access, audit }.
 */
export function residentRoute(handler, { auth = true, stay = true, write = false } = {}) {
  return async (request, context) => {
    try {
      if (!['GET', 'HEAD'].includes(request.method)) assertSameOrigin(request)
      await dbConnect()
      const params = (await context?.params) ?? {}
      if (!auth) return await handler({ request, params })

      const resident = await authenticateResident(request)
      if (!resident) return clearResidentCookie(json({ message: 'Please sign in again.' }, 401))

      let ctx = {}
      if (stay) {
        const tenancyId = request.headers.get('x-tenancy') ?? new URL(request.url).searchParams.get('tenancy')
        if (!mongoose.isValidObjectId(tenancyId)) throw new ApiError(400, 'Choose which stay this is about.')
        const tenant = await Tenant.findOne({ _id: tenancyId, residentId: resident._id })
        if (!tenant) throw new ApiError(404, 'Stay not found.')
        const [org, property] = await Promise.all([
          User.findById(tenant.userId),
          tenant.propertyId ? Property.findById(tenant.propertyId) : null,
        ])
        const { access, reason } = stayAccess(tenant, org)
        if (write && access !== 'full') throw new ApiError(403, reason, 'READ_ONLY')
        ctx = { tenant, org, property, access, readReason: reason }
      }
      const audit = (action, extra = {}) => recordAudit({
        actor: { realm: 'resident', id: resident._id, name: ctx.tenant?.name ?? resident.name, role: 'tenant' },
        action, orgId: ctx.org?._id ?? null, request, ...extra,
      })
      return await handler({ request, params, resident, audit, ...ctx })
    } catch (err) {
      return errorResponse(err)
    }
  }
}
