import Tenant from '@/lib/models/Tenant'
import { readJson, json, ApiError } from '@/lib/api'
import { residentRoute } from '@/lib/residentApi'
import { issueOtp } from '@/lib/otp'
import { sendOtp, smsProvider } from '@/lib/messaging'
import { devFallbacksAllowed } from '@/lib/devMode'
import { backfillPhoneKeys } from '@/lib/cronJobs'
import { rateLimit, clientIp } from '@/lib/rateLimit'
import { isValidPhone, toWhatsAppNumber } from '@/utils/helpers'

let backfilled = null

// Step 1 of tenant sign-in: send a 6-digit code to the phone number the PG owner has on record.
// The answer is the same whether or not the number is registered, so it can't be used to look people up.
export const POST = residentRoute(async ({ request }) => {
  const { phone } = await readJson(request)
  if (!isValidPhone(phone)) throw new ApiError(400, 'Enter your 10-digit mobile number.')
  const key = toWhatsAppNumber(phone)

  const limits = [
    rateLimit(`otp:phone:${key}`, { limit: 3, windowMs: 10 * 60 * 1000 }),
    rateLimit(`otp:phone-day:${key}`, { limit: 10, windowMs: 24 * 60 * 60 * 1000 }),
    rateLimit(`otp:ip:${clientIp(request)}`, { limit: 20, windowMs: 60 * 60 * 1000 }),
  ]
  const blocked = limits.find(l => !l.ok)
  if (blocked) throw new ApiError(429, `Too many codes requested. Try again in ${Math.ceil(blocked.retryAfter / 60)} minute(s).`)

  const sms = smsProvider()
  const dev = !sms && devFallbacksAllowed(request)
  if (!sms && !dev) throw new ApiError(503, 'Tenant sign-in by phone is not available yet. Please contact your PG.')

  backfilled ??= backfillPhoneKeys().catch(() => null) // tenants added before the tenant app existed
  await backfilled
  const registered = await Tenant.exists({ phoneKey: key })

  let devCode
  if (registered) {
    const code = await issueOtp(key)
    try {
      await sendOtp(key, code)
    } catch (err) {
      console.error('[otp] send failed', err)
      throw new ApiError(502, 'Could not send the code right now. Please try again in a minute.')
    }
    if (dev) devCode = code
  }
  return json({
    ok: true,
    phone: `+${key.slice(0, key.length - 10)} ${key.slice(-10, -5)} ${key.slice(-5)}`,
    message: 'If this number is registered with a PG on PGBook, a 6-digit code is on its way. It is valid for 10 minutes.',
    ...(devCode ? { devCode, devNote: 'Development mode: no SMS provider is set up, so the code is shown here.' } : {}),
  })
}, { auth: false })
