import QRCode from 'qrcode'
import PlatformAdmin from '@/lib/models/PlatformAdmin'
import { readJson, json, ApiError } from '@/lib/api'
import { adminRoute, checkAdminTotp } from '@/lib/adminApi'
import { adminFromPreCookie, completeAdminSignIn } from '@/lib/adminSignIn'
import { registerFailure } from '@/lib/adminLockout'
import { adminActor, recordAudit } from '@/lib/audit'
import { generateTotpSecret, otpauthUrl } from '@/lib/totp'
import { seal, open } from '@/lib/secretBox'

// First sign-in (or after a 2FA reset): 2FA is mandatory, so the admin must set
// up an authenticator app before any session is issued.

export const GET = adminRoute(async ({ request }) => {
  const pre = await adminFromPreCookie(request, 'enroll')
  const admin = await PlatformAdmin.findById(pre._id).select('+totpPendingSecret')
  // Reuse a pending secret so a page refresh doesn't invalidate an app that was already scanned.
  let secret = admin.totpPendingSecret ? open(admin.totpPendingSecret) : null
  if (!secret) {
    secret = generateTotpSecret()
    admin.totpPendingSecret = seal(secret)
    await admin.save()
  }
  const url = otpauthUrl(secret, admin.email)
  const qr = await QRCode.toDataURL(url, { margin: 1, width: 220 })
  return json({ secret: secret.match(/.{1,4}/g).join(' '), otpauthUrl: url, qr, email: admin.email })
}, { auth: false })

export const POST = adminRoute(async ({ request }) => {
  const pre = await adminFromPreCookie(request, 'enroll')
  const { code } = await readJson(request)
  if (!(await checkAdminTotp(pre._id, code, { pending: true }))) {
    await registerFailure(pre, '2fa-enroll', request)
    throw new ApiError(401, 'That code is not valid. Make sure you scanned the latest QR code.')
  }
  const admin = await PlatformAdmin.findById(pre._id).select('+totpPendingSecret +totpSecret')
  admin.totpSecret = admin.totpPendingSecret
  admin.totpPendingSecret = null
  admin.totpEnabledAt = new Date()
  await admin.save()
  await recordAudit({ actor: adminActor(admin), action: 'admin.2fa_enrolled', request }, { critical: true })
  return completeAdminSignIn(admin, request)
}, { auth: false })
