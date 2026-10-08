import PlatformAdmin from '@/lib/models/PlatformAdmin'
import { readJson, json, ApiError } from '@/lib/api'
import { adminRoute, checkAdminTotp, STEP_UP_WINDOW_MS } from '@/lib/adminApi'
import { rateLimit } from '@/lib/rateLimit'

// Re-verification before sensitive actions: a fresh 2FA code unlocks them for 5 minutes.
export const POST = adminRoute(async ({ request, admin, audit }) => {
  const limit = rateLimit(`admin-step-up:${admin._id}`, { limit: 10, windowMs: 15 * 60 * 1000 })
  if (!limit.ok) throw new ApiError(429, 'Too many attempts. Please wait a few minutes.')
  const { code } = await readJson(request)
  if (!(await checkAdminTotp(admin._id, code))) {
    await audit('admin.step_up_failed')
    throw new ApiError(401, 'That code is not valid.')
  }
  await PlatformAdmin.updateOne({ _id: admin._id }, { $set: { stepUpAt: new Date() } })
  await audit('admin.step_up')
  return json({ ok: true, validForMinutes: STEP_UP_WINDOW_MS / 60000 })
})
