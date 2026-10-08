import PlatformAdmin from './models/PlatformAdmin.js'
import { ADMIN_PRE_COOKIE, verifyAdminPreToken, clearAdminPreCookie } from './auth'
import { ApiError, json } from './api'
import { issueAdminSession } from './adminApi'
import { adminActor, recordAudit } from './audit'
import { clientIp } from './rateLimit'
import { capabilitiesFor, ADMIN_ROLES } from './policy'

/** Loads the admin from the short-lived "password OK" cookie, for the given step. */
export async function adminFromPreCookie(request, purpose) {
  const pre = await verifyAdminPreToken(request.cookies?.get(ADMIN_PRE_COOKIE)?.value)
  if (!pre || pre.purpose !== purpose) throw new ApiError(401, 'Your sign-in has expired. Please start again.')
  const admin = await PlatformAdmin.findById(pre.id)
  if (!admin || admin.status !== 'active') throw new ApiError(401, 'Your sign-in has expired. Please start again.')
  if (admin.lockedUntil && admin.lockedUntil > new Date()) {
    throw new ApiError(429, 'This account is temporarily locked after failed attempts. Try again in 15 minutes.')
  }
  return admin
}

export function adminProfile(admin) {
  const actor = adminActor(admin)
  return { ...admin.toJSON(), roleLabel: ADMIN_ROLES[admin.role], capabilities: capabilitiesFor(actor) }
}

/** Final step of sign-in: records it and issues the admin session cookie. */
export async function completeAdminSignIn(admin, request) {
  const now = new Date()
  admin.lastLoginAt = now
  admin.lastLoginIp = clientIp(request)
  admin.lastActivityAt = now
  admin.stepUpAt = now // a fresh 2FA code counts as recent verification
  admin.failedLogins = 0
  admin.lockedUntil = null
  await recordAudit({ actor: adminActor(admin), action: 'admin.login', request }, { critical: true })
  await PlatformAdmin.updateOne({ _id: admin._id }, {
    $set: { lastLoginAt: now, lastLoginIp: admin.lastLoginIp, lastActivityAt: now, stepUpAt: now, failedLogins: 0, lockedUntil: null },
  })
  const response = clearAdminPreCookie(json({ admin: adminProfile(admin) }))
  return issueAdminSession(response, admin)
}
