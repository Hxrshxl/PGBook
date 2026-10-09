import PlatformAdmin, { ADMIN_PASSWORD_MIN_LENGTH } from '@/lib/models/PlatformAdmin'
import { readJson, json, ApiError } from '@/lib/api'
import { adminRoute } from '@/lib/adminApi'
import { adminActor, recordAudit } from '@/lib/audit'
import { ADMIN_ROLES } from '@/lib/policy'
import { hashToken } from '@/lib/secretBox'
import { rateLimit, clientIp } from '@/lib/rateLimit'

async function findInvited(token) {
  if (typeof token !== 'string' || token.length < 20) throw new ApiError(400, 'This invite link is not valid.')
  const admin = await PlatformAdmin.findOne({ inviteTokenHash: hashToken(token), status: 'invited' }).select('+inviteTokenHash')
  if (!admin || !admin.inviteExpiresAt || admin.inviteExpiresAt < new Date()) {
    throw new ApiError(410, 'This invite link has expired or was already used. Ask a Super Admin for a new one.')
  }
  return admin
}

export const GET = adminRoute(async ({ request }) => {
  const admin = await findInvited(new URL(request.url).searchParams.get('token'))
  return json({ name: admin.name, email: admin.email, role: ADMIN_ROLES[admin.role] })
}, { auth: false })

// Accepting an invite only sets the password. 2FA is set up on first sign-in.
export const POST = adminRoute(async ({ request }) => {
  const limit = rateLimit(`admin-invite:${clientIp(request)}`, { limit: 10, windowMs: 15 * 60 * 1000 })
  if (!limit.ok) throw new ApiError(429, 'Too many attempts. Please wait a few minutes.')
  const { token, password } = await readJson(request)
  if (typeof password !== 'string' || password.length < ADMIN_PASSWORD_MIN_LENGTH || password.length > 128) {
    throw new ApiError(400, `Admin passwords must be ${ADMIN_PASSWORD_MIN_LENGTH}–128 characters.`)
  }
  const admin = await findInvited(token)
  admin.password = password
  admin.status = 'active'
  admin.inviteTokenHash = null
  admin.inviteExpiresAt = null
  await recordAudit({ actor: adminActor(admin), action: 'admin.invite_accepted', request }, { critical: true })
  await admin.save()
  return json({ ok: true, email: admin.email })
}, { auth: false })
