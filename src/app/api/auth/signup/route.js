import User, { PASSWORD_MIN_LENGTH } from '@/lib/models/User'
import { route, readJson, json, ApiError } from '@/lib/api'
import { signToken, setSessionCookie } from '@/lib/auth'
import { orgActor, recordAudit } from '@/lib/audit'
import { rateLimit, clientIp } from '@/lib/rateLimit'

export const POST = route(async ({ request }) => {
  const limit = rateLimit(`signup:ip:${clientIp(request)}`, { limit: 10, windowMs: 60 * 60 * 1000 })
  if (!limit.ok) throw new ApiError(429, 'Too many sign-up attempts. Please try again later.')

  const { name, pgName, email, password } = await readJson(request)
  if (typeof name !== 'string' || typeof email !== 'string' || typeof password !== 'string' || !name.trim() || !email.trim()) {
    throw new ApiError(400, 'Name, email, and password are required.')
  }
  if (password.length < PASSWORD_MIN_LENGTH) {
    throw new ApiError(400, `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`)
  }
  if (password.length > 128) throw new ApiError(400, 'Password is too long.')

  const normalizedEmail = email.toLowerCase().trim()
  if (await User.exists({ email: normalizedEmail })) {
    throw new ApiError(409, 'An account with this email already exists.')
  }

  const pg = typeof pgName === 'string' ? pgName.trim() : ''
  const user = await User.create({
    name: name.trim(),
    email: normalizedEmail,
    password,
    pgSettings: { pgName: pg, ownerName: name.trim(), logoText: pg },
    lastLoginAt: new Date(),
    lastActiveAt: new Date(),
  })
  await recordAudit({ actor: orgActor(user), action: 'org.signup', orgId: user._id, target: { kind: 'org', id: user._id.toString(), label: pg || user.name }, request })

  const token = await signToken({ id: user._id.toString(), tokenVersion: user.tokenVersion })
  return setSessionCookie(json({ user: user.toJSON() }, 201), token)
}, { auth: false })
