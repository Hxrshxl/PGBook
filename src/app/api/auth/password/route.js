import User, { PASSWORD_MIN_LENGTH } from '@/lib/models/User'
import { route, readJson, json, ApiError } from '@/lib/api'
import { signToken, setSessionCookie } from '@/lib/auth'
import { rateLimit } from '@/lib/rateLimit'

export const PUT = route(async ({ request, user, audit }) => {
  const limit = rateLimit(`password:${user._id}`, { limit: 10, windowMs: 15 * 60 * 1000 })
  if (!limit.ok) throw new ApiError(429, 'Too many attempts. Please try again later.')

  const { currentPassword, newPassword } = await readJson(request)
  if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') {
    throw new ApiError(400, 'Current and new password are required.')
  }
  if (newPassword.length < PASSWORD_MIN_LENGTH) {
    throw new ApiError(400, `New password must be at least ${PASSWORD_MIN_LENGTH} characters.`)
  }
  if (newPassword.length > 128) throw new ApiError(400, 'Password is too long.')

  const account = await User.findById(user._id).select('+password')
  if (!(await account.comparePassword(currentPassword))) {
    throw new ApiError(400, 'Current password is incorrect.')
  }

  account.password = newPassword
  account.tokenVersion = (account.tokenVersion ?? 0) + 1 // signs out every other session
  await account.save()
  await audit('auth.password_changed')

  const token = await signToken({ id: account._id.toString(), tokenVersion: account.tokenVersion })
  return setSessionCookie(json({ ok: true }), token)
}, { readOnlyOk: true })
