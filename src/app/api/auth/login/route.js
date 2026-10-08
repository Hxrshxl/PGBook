import User from '@/lib/models/User'
import { route, readJson, json, ApiError } from '@/lib/api'
import { signToken, setSessionCookie } from '@/lib/auth'
import { orgActor, recordAudit } from '@/lib/audit'
import { rateLimit, clientIp } from '@/lib/rateLimit'

export const POST = route(async ({ request }) => {
  const { email, password } = await readJson(request)
  if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
    throw new ApiError(400, 'Email and password are required.')
  }
  const normalizedEmail = email.toLowerCase().trim()

  const ip = clientIp(request)
  const limits = [
    rateLimit(`login:ip:${ip}`, { limit: 30, windowMs: 15 * 60 * 1000 }),
    rateLimit(`login:email:${normalizedEmail}`, { limit: 10, windowMs: 15 * 60 * 1000 }),
  ]
  const blocked = limits.find(l => !l.ok)
  if (blocked) {
    throw new ApiError(429, `Too many sign-in attempts. Try again in ${Math.ceil(blocked.retryAfter / 60)} minute(s).`)
  }

  const user = await User.findOne({ email: normalizedEmail }).select('+password')
  const valid = user && (await user.comparePassword(password))
  if (!valid) {
    if (user) {
      await recordAudit({ actor: { realm: 'org', id: null, name: 'Unknown', role: 'anonymous' }, action: 'auth.login_failed', orgId: user._id, request })
    }
    throw new ApiError(401, 'Invalid email or password.')
  }
  // Only revealed after a correct password, so it can't be used to probe which accounts exist.
  if (user.status === 'suspended') {
    await recordAudit({ actor: orgActor(user), action: 'auth.login_blocked', orgId: user._id, request })
    throw new ApiError(403, 'This account has been suspended. Please contact PGBook support at hello@pgbook.in.')
  }

  const now = new Date()
  await User.updateOne({ _id: user._id }, { $set: { lastLoginAt: now, lastActiveAt: now } })
  await recordAudit({ actor: orgActor(user), action: 'auth.login', orgId: user._id, request })

  const token = await signToken({ id: user._id.toString(), tokenVersion: user.tokenVersion })
  return setSessionCookie(json({ user: user.toJSON() }), token)
}, { auth: false })
