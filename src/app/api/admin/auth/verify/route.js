import { readJson, ApiError } from '@/lib/api'
import { adminRoute, checkAdminTotp } from '@/lib/adminApi'
import { adminFromPreCookie, completeAdminSignIn } from '@/lib/adminSignIn'
import { registerFailure } from '@/lib/adminLockout'

// Step 2 of 2: the 6-digit code from the authenticator app.
export const POST = adminRoute(async ({ request }) => {
  const admin = await adminFromPreCookie(request, 'totp')
  const { code } = await readJson(request)
  if (!(await checkAdminTotp(admin._id, code))) {
    await registerFailure(admin, '2fa', request)
    throw new ApiError(401, 'That code is not valid. Check your authenticator app and try again.')
  }
  return completeAdminSignIn(admin, request)
}, { auth: false })
