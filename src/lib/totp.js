// Time-based one-time passwords (RFC 6238), compatible with Google Authenticator,
// Microsoft Authenticator, Authy, 1Password etc. SHA-1, 6 digits, 30-second steps.
import crypto from 'node:crypto'

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
const STEP_SECONDS = 30
const DIGITS = 6

export function base32Encode(buffer) {
  let bits = 0
  let value = 0
  let out = ''
  for (const byte of buffer) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31]
  return out
}

export function base32Decode(text) {
  const clean = String(text).toUpperCase().replace(/[\s=-]/g, '')
  let bits = 0
  let value = 0
  const bytes = []
  for (const char of clean) {
    const index = ALPHABET.indexOf(char)
    if (index === -1) throw new Error('Invalid base32 secret.')
    value = (value << 5) | index
    bits += 5
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255)
      bits -= 8
    }
  }
  return Buffer.from(bytes)
}

export function generateTotpSecret() {
  return base32Encode(crypto.randomBytes(20))
}

export function hotp(secretBytes, counter, digits = DIGITS) {
  const message = Buffer.alloc(8)
  message.writeBigUInt64BE(BigInt(counter))
  const hmac = crypto.createHmac('sha1', secretBytes).update(message).digest()
  const offset = hmac[hmac.length - 1] & 0xf
  const code = ((hmac[offset] & 0x7f) << 24) | (hmac[offset + 1] << 16) | (hmac[offset + 2] << 8) | hmac[offset + 3]
  return String(code % 10 ** digits).padStart(digits, '0')
}

export function currentStep(now = Date.now()) {
  return Math.floor(now / 1000 / STEP_SECONDS)
}

export function totpAt(secret, step) {
  return hotp(base32Decode(secret), step)
}

/**
 * Checks a code against the current step ± `window` steps (clock drift).
 * Returns the matched step, or null. Steps at or before `lastStep` are
 * rejected so a code can't be used twice.
 */
export function verifyTotp(secret, code, { window = 1, lastStep = -1, now = Date.now() } = {}) {
  const normalized = String(code ?? '').replace(/\s/g, '')
  if (!/^\d{6}$/.test(normalized)) return null
  const secretBytes = base32Decode(secret)
  const step = currentStep(now)
  for (let s = step - window; s <= step + window; s++) {
    if (s <= lastStep) continue
    const expected = hotp(secretBytes, s)
    if (crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(normalized))) return s
  }
  return null
}

export function otpauthUrl(secret, account, issuer = 'PGBook Admin') {
  const label = encodeURIComponent(`${issuer}:${account}`)
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=${DIGITS}&period=${STEP_SECONDS}`
}
