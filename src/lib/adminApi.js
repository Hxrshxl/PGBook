import mongoose from 'mongoose'
import dbConnect from './db'
import PlatformAdmin from './models/PlatformAdmin'
import { ADMIN_COOKIE, verifyAdminToken, signAdminToken, setAdminSessionCookie, clearAdminSessionCookie } from './auth'
import { ApiError, assertSameOrigin, errorResponse, json } from './api'
import { can } from './policy'
import { adminActor, recordAudit } from './audit'
import { verifyTotp } from './totp'
import { open } from './secretBox'

export const ADMIN_IDLE_TIMEOUT_MS = 30 * 60 * 1000
export const STEP_UP_WINDOW_MS = 5 * 60 * 1000
const ACTIVITY_WRITE_INTERVAL_MS = 60 * 1000

/**
 * Wraps an admin route: CSRF check, admin session (2FA-verified), role permission,
 * optional step-up (fresh 2FA code within 5 minutes) and error handling.
 *
 * The handler receives { request, params, admin, actor, audit }. audit() is
 * critical: if the event can't be recorded, the action fails.
 */
export function adminRoute(handler, { auth = true, permission, stepUp = false } = {}) {
  return async (request, context) => {
    try {
      if (!['GET', 'HEAD'].includes(request.method)) assertSameOrigin(request)
      await dbConnect()
      const params = (await context?.params) ?? {}
      if (!auth) return await handler({ request, params })

      const admin = await authenticateAdmin(request)
      if (!admin) {
        return clearAdminSessionCookie(json({ message: 'Your admin session has ended. Please sign in again.' }, 401))
      }
      const actor = adminActor(admin)
      if (permission && !can(actor, permission)) throw new ApiError(403, 'Your role does not allow this action.')
      if (stepUp && !hasRecentStepUp(admin)) {
        throw new ApiError(403, 'Please confirm it is you with a code from your authenticator app.', 'STEP_UP_REQUIRED')
      }
      const audit = (action, extra = {}) => recordAudit({ actor, action, request, ...extra }, { critical: true })
      return await handler({ request, params, admin, actor, audit })
    } catch (err) {
      return errorResponse(err)
    }
  }
}

export async function authenticateAdmin(request) {
  const session = await verifyAdminToken(request.cookies?.get(ADMIN_COOKIE)?.value)
  if (!session || !mongoose.isValidObjectId(session.id)) return null
  const admin = await PlatformAdmin.findById(session.id)
  if (!admin || admin.status !== 'active' || !admin.totpEnabledAt) return null
  if ((admin.tokenVersion ?? 0) !== session.tokenVersion) return null

  const now = Date.now()
  if (admin.lastActivityAt && now - admin.lastActivityAt.getTime() > ADMIN_IDLE_TIMEOUT_MS) return null
  if (!admin.lastActivityAt || now - admin.lastActivityAt.getTime() > ACTIVITY_WRITE_INTERVAL_MS) {
    admin.lastActivityAt = new Date(now)
    await PlatformAdmin.updateOne({ _id: admin._id }, { $set: { lastActivityAt: admin.lastActivityAt } })
  }
  return admin
}

export function hasRecentStepUp(admin) {
  return !!admin.stepUpAt && Date.now() - admin.stepUpAt.getTime() < STEP_UP_WINDOW_MS
}

export async function issueAdminSession(response, admin) {
  return setAdminSessionCookie(response, await signAdminToken({ id: admin._id.toString(), tokenVersion: admin.tokenVersion }))
}

/**
 * Verifies a 2FA code for an admin and records the step as used, atomically,
 * so the same code can't be replayed (even by two requests racing).
 */
export async function checkAdminTotp(adminId, code, { pending = false } = {}) {
  const admin = await PlatformAdmin.findById(adminId).select('+totpSecret +totpPendingSecret +lastTotpStep')
  const sealed = pending ? admin?.totpPendingSecret : admin?.totpSecret
  if (!sealed) return false
  const step = verifyTotp(open(sealed), code, { lastStep: admin.lastTotpStep ?? -1 })
  if (step === null) return false
  const claimed = await PlatformAdmin.updateOne(
    { _id: admin._id, lastTotpStep: { $lt: step } },
    { $set: { lastTotpStep: step } },
  )
  return claimed.modifiedCount === 1
}
