import PlatformAdmin, { ADMIN_PASSWORD_MIN_LENGTH } from '@/lib/models/PlatformAdmin'
import { readJson, json, ApiError } from '@/lib/api'
import { adminRoute, issueAdminSession } from '@/lib/adminApi'

export const PUT = adminRoute(async ({ request, admin, audit }) => {
  const { currentPassword, newPassword } = await readJson(request)
  if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') {
    throw new ApiError(400, 'Current and new password are required.')
  }
  if (newPassword.length < ADMIN_PASSWORD_MIN_LENGTH || newPassword.length > 128) {
    throw new ApiError(400, `Admin passwords must be ${ADMIN_PASSWORD_MIN_LENGTH}–128 characters.`)
  }
  const account = await PlatformAdmin.findById(admin._id).select('+password')
  if (!(await account.comparePassword(currentPassword))) throw new ApiError(400, 'Current password is incorrect.')
  account.password = newPassword
  account.tokenVersion += 1 // signs out other sessions
  await audit('admin.password_changed')
  await account.save()
  return issueAdminSession(json({ ok: true }), account)
}, { stepUp: true })
