// One-time login codes for the tenant app.
// 6 digits, valid 10 minutes, 5 attempts, single use. Only a keyed hash is stored.
import crypto from 'node:crypto'
import OtpChallenge from './models/OtpChallenge.js'
import { ApiError } from './api.js'

export const OTP_TTL_MS = 10 * 60 * 1000
export const OTP_MAX_ATTEMPTS = 5

function hashCode(phone, code) {
  const secret = process.env.JWT_SECRET
  if (!secret || secret.length < 32) throw new Error('JWT_SECRET must be set.')
  return crypto.createHmac('sha256', `pgbook-otp:${secret}`).update(`${phone}:${code}`).digest('hex')
}

/** Creates a new code for a phone (earlier unused codes stop working) and returns it. */
export async function issueOtp(phone) {
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0')
  await OtpChallenge.updateMany({ phone, consumedAt: null }, { $set: { consumedAt: new Date() } })
  await OtpChallenge.create({ phone, codeHash: hashCode(phone, code), expiresAt: new Date(Date.now() + OTP_TTL_MS) })
  return code
}

/** Checks a code. Throws a user-facing error when it's wrong, expired or used up. */
export async function verifyOtp(phone, code) {
  if (!/^\d{6}$/.test(String(code ?? ''))) throw new ApiError(400, 'Enter the 6-digit code.')
  const challenge = await OtpChallenge.findOneAndUpdate(
    { phone, consumedAt: null, expiresAt: { $gt: new Date() }, attempts: { $lt: OTP_MAX_ATTEMPTS } },
    { $inc: { attempts: 1 } },
    { sort: { createdAt: -1 }, new: true },
  )
  if (!challenge) throw new ApiError(400, 'This code has expired or was tried too many times. Request a new code.')

  const a = Buffer.from(challenge.codeHash)
  const b = Buffer.from(hashCode(phone, String(code)))
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    const left = OTP_MAX_ATTEMPTS - challenge.attempts
    throw new ApiError(400, left > 0 ? `That code is not right. ${left} attempt${left === 1 ? '' : 's'} left.` : 'That code is not right. Request a new code.')
  }
  // Single use, even if two requests race.
  const used = await OtpChallenge.updateOne({ _id: challenge._id, consumedAt: null }, { $set: { consumedAt: new Date() } })
  if (used.modifiedCount !== 1) throw new ApiError(400, 'This code was already used. Request a new code.')
}
