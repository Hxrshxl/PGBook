import PlatformAdmin from '@/lib/models/PlatformAdmin'
import { readJson, json, ApiError } from '@/lib/api'
import { adminRoute } from '@/lib/adminApi'
import { signAdminPreToken, setAdminPreCookie } from '@/lib/auth'
import { adminActor, recordAudit } from '@/lib/audit'
import { rateLimit, clientIp } from '@/lib/rateLimit'
import { registerFailure } from '@/lib/adminLockout'

// Step 1 of 2: email + password. Success only proves the password —
// the session is issued after the 2FA code (or first-time 2FA setup).
export const POST = adminRoute(async ({ request }) => {
  const { email, password } = await readJson(request)
  if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
    throw new ApiError(400, 'Email and password are required.')
  }
  const normalized = email.toLowerCase().trim()
  const limits = [
    rateLimit(`admin-login:ip:${clientIp(request)}`, { limit: 20, windowMs: 15 * 60 * 1000 }),
    rateLimit(`admin-login:email:${normalized}`, { limit: 8, windowMs: 15 * 60 * 1000 }),
  ]
  if (limits.some(l => !l.ok)) throw new ApiError(429, 'Too many sign-in attempts. Please wait 15 minutes.')

  const admin = await PlatformAdmin.findOne({ email: normalized }).select('+password')
  const invalid = new ApiError(401, 'Invalid email or password.')
  if (!admin || admin.status === 'invited' || !admin.password) throw invalid
  if (admin.lockedUntil && admin.lockedUntil > new Date()) {
    throw new ApiError(429, 'This account is temporarily locked after failed attempts. Try again in 15 minutes.')
  }

  if (!(await admin.comparePassword(password))) {
    await registerFailure(admin, 'password', request)
    throw invalid
  }
  if (admin.status === 'disabled') {
    await recordAudit({ actor: adminActor(admin), action: 'admin.login_blocked', reason: 'Account disabled', request })
    throw new ApiError(403, 'This admin account is disabled.')
  }

  const purpose = admin.totpEnabledAt ? 'totp' : 'enroll'
  return setAdminPreCookie(json({ next: purpose }), await signAdminPreToken({ id: admin._id.toString(), purpose }))
}, { auth: false })
