import Resident from '@/lib/models/Resident'
import Tenant from '@/lib/models/Tenant'
import { readJson, json, ApiError } from '@/lib/api'
import { residentRoute } from '@/lib/residentApi'
import { verifyOtp } from '@/lib/otp'
import { signResidentToken, setResidentCookie } from '@/lib/auth'
import { tenanciesFor } from '@/lib/residentData'
import { rateLimit, clientIp } from '@/lib/rateLimit'
import { isValidPhone, toWhatsAppNumber } from '@/utils/helpers'

// Step 2: check the code, link every stay registered under this phone number, and sign in.
export const POST = residentRoute(async ({ request }) => {
  const { phone, code } = await readJson(request)
  if (!isValidPhone(phone)) throw new ApiError(400, 'Enter your 10-digit mobile number.')
  const key = toWhatsAppNumber(phone)
  const limit = rateLimit(`otp-verify:ip:${clientIp(request)}`, { limit: 30, windowMs: 15 * 60 * 1000 })
  if (!limit.ok) throw new ApiError(429, 'Too many attempts. Please wait a few minutes.')

  await verifyOtp(key, code)

  const first = await Tenant.findOne({ phoneKey: key }).sort({ status: 1, createdAt: -1 }).select('name')
  if (!first) throw new ApiError(400, 'No PG stay is registered with this number. Ask your PG to check your phone number.')
  const now = new Date()
  const resident = await Resident.findOneAndUpdate(
    { phone: key },
    { $setOnInsert: { phone: key, name: first.name }, $set: { lastLoginAt: now, lastSeenAt: now } },
    { upsert: true, new: true },
  )
  if (resident.status !== 'active') throw new ApiError(403, 'This number has been blocked from signing in. Please contact PGBook support.')
  await Tenant.updateMany({ phoneKey: key, residentId: null }, { $set: { residentId: resident._id } })

  const token = await signResidentToken({ id: resident._id.toString(), tokenVersion: resident.tokenVersion })
  return setResidentCookie(json({ resident: resident.toJSON(), tenancies: await tenanciesFor(resident) }), token)
}, { auth: false })
