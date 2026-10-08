import { NextResponse } from 'next/server'
import mongoose from 'mongoose'
import dbConnect from './db'
import User from './models/User'
import { clearSessionCookie, getTokenFromRequest, verifyToken } from './auth'
import { can } from './policy'
import { orgActor, recordAudit } from './audit'
import { makeScope, resolveOrgContext } from './orgContext'

// Time zone used for "today" on the server (rent months, vacate dates, receipts).
export const APP_TIME_ZONE = process.env.APP_TIME_ZONE || 'Asia/Kolkata'

export class ApiError extends Error {
  constructor(status, message, code) {
    super(message)
    this.status = status
    this.code = code // machine-readable, e.g. STEP_UP_REQUIRED
  }
}

export function json(data, status = 200) {
  return NextResponse.json(data, { status })
}

/**
 * Wraps an owner/staff-facing route handler with DB connection, authentication,
 * organization context, permission checks, CSRF protection and uniform errors.
 *
 * The handler receives:
 *   user   — the person signed in (owner or staff member)
 *   org    — the owner account whose data this is (same as user for owners)
 *   role   — 'owner' | 'manager' | 'accountant' | 'caretaker'
 *   scope  — query helpers limited to this organization and the properties the user may access
 *   actor  — who is acting, for permission checks and the audit log
 *   audit(action, { target, details, reason }) — records an event in the organization's activity log
 */
export function route(handler, { auth = true, permission } = {}) {
  return async (request, context) => {
    try {
      if (!['GET', 'HEAD'].includes(request.method)) assertSameOrigin(request)
      await dbConnect()
      const params = (await context?.params) ?? {}
      if (!auth) {
        const audit = (action, extra = {}) => recordAudit({ action, request, ...extra })
        return await handler({ request, params, audit })
      }

      const user = await authenticate(request)
      const ctx = user ? await resolveOrgContext(user) : null
      if (!ctx) {
        // Clear a stale cookie (password changed elsewhere, account suspended, staff access removed…),
        // otherwise the middleware would keep treating the browser as signed in.
        return clearSessionCookie(json({ message: 'Your session has expired. Please sign in again.' }, 401))
      }
      const actor = { ...orgActor(user), role: ctx.role, orgId: ctx.org._id }
      if (permission && !can(actor, permission)) throw new ApiError(403, 'Your role does not allow this.')
      const scope = makeScope(ctx)
      const audit = (action, extra = {}) => recordAudit({ actor: orgActor(user, ctx.role), action, orgId: ctx.org._id, request, ...extra })
      return await handler({ request, params, user, org: ctx.org, role: ctx.role, membership: ctx.membership, scope, actor, audit })
    } catch (err) {
      return errorResponse(err)
    }
  }
}

const ACTIVITY_WRITE_INTERVAL_MS = 5 * 60 * 1000

export async function authenticate(request) {
  const session = await verifyToken(getTokenFromRequest(request))
  if (!session || !mongoose.isValidObjectId(session.id)) return null
  const user = await User.findById(session.id)
  // tokenVersion is bumped on password change or a forced sign-out, which ends existing sessions
  if (!user || (user.tokenVersion ?? 0) !== session.tokenVersion) return null
  if (user.status === 'suspended') return null
  if (!user.lastActiveAt || Date.now() - user.lastActiveAt.getTime() > ACTIVITY_WRITE_INTERVAL_MS) {
    user.lastActiveAt = new Date()
    await User.updateOne({ _id: user._id }, { $set: { lastActiveAt: user.lastActiveAt } })
  }
  return user
}

// Browsers always send Origin (and usually Sec-Fetch-Site) on cross-site
// requests, so rejecting mismatches blocks CSRF against the session cookie.
export function assertSameOrigin(request) {
  if (request.headers.get('sec-fetch-site') === 'cross-site') {
    throw new ApiError(403, 'Cross-site request blocked.')
  }
  const origin = request.headers.get('origin')
  if (!origin) return
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host')
  let originHost
  try {
    originHost = new URL(origin).host
  } catch {
    throw new ApiError(403, 'Cross-site request blocked.')
  }
  if (originHost !== host) throw new ApiError(403, 'Cross-site request blocked.')
}

export async function readJson(request) {
  let body
  try {
    body = await request.json()
  } catch {
    throw new ApiError(400, 'Request body must be valid JSON.')
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ApiError(400, 'Request body must be a JSON object.')
  }
  return body
}

/** Copies only the listed keys that are present in `source`. Prevents mass assignment. */
export function pick(source, keys) {
  const out = {}
  for (const key of keys) {
    if (source[key] !== undefined) out[key] = source[key]
  }
  return out
}

export function assertObjectId(id, label = 'Record') {
  if (!mongoose.isValidObjectId(id)) throw new ApiError(404, `${label} not found.`)
}

export function errorResponse(err) {
  if (err instanceof ApiError) {
    return json(err.code ? { message: err.message, code: err.code } : { message: err.message }, err.status)
  }
  if (err?.name === 'ValidationError') {
    const first = Object.values(err.errors ?? {})[0]
    return json({ message: first?.message ?? 'Invalid data.' }, 400)
  }
  if (err?.name === 'CastError') {
    return json({ message: `Invalid value for ${err.path}.` }, 400)
  }
  if (err?.code === 11000) {
    return json({ message: 'A matching record already exists.' }, 409)
  }
  console.error('[api] Unhandled error:', err)
  return json({ message: 'Something went wrong. Please try again.' }, 500)
}
