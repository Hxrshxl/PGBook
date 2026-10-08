import { beforeAll, describe, expect, it } from 'vitest'
import { base32Decode, base32Encode, generateTotpSecret, hotp, totpAt, verifyTotp, otpauthUrl } from './totp.js'
import { can, maxTrialExtension } from './policy.js'
import { describeEvent } from '../utils/auditText.js'

beforeAll(() => {
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-that-is-definitely-longer-than-32-chars'
})

// RFC 6238 Appendix B (SHA-1), secret = ASCII "12345678901234567890"; we use the last 6 digits.
const RFC_SECRET = base32Encode(Buffer.from('12345678901234567890'))
const RFC_VECTORS = [
  [59, '287082'],
  [1111111109, '081804'],
  [1111111111, '050471'],
  [1234567890, '005924'],
  [2000000000, '279037'],
]

describe('TOTP (RFC 6238)', () => {
  it('matches the RFC test vectors', () => {
    for (const [seconds, code] of RFC_VECTORS) {
      expect(totpAt(RFC_SECRET, Math.floor(seconds / 30))).toBe(code)
    }
  })

  it('round-trips base32', () => {
    const bytes = Buffer.from([0, 1, 2, 250, 251, 252, 253, 254, 255])
    expect(base32Decode(base32Encode(bytes))).toEqual(bytes)
    expect(base32Decode('gezd gnbv-gy3t')).toEqual(base32Decode('GEZDGNBVGY3T'))
  })

  it('accepts the current code and ±1 step of clock drift', () => {
    const secret = generateTotpSecret()
    const now = Date.now()
    const step = Math.floor(now / 30000)
    expect(verifyTotp(secret, totpAt(secret, step), { now })).toBe(step)
    expect(verifyTotp(secret, totpAt(secret, step - 1), { now })).toBe(step - 1)
    expect(verifyTotp(secret, totpAt(secret, step + 3), { now })).toBeNull()
  })

  it('refuses to reuse a code (replay protection)', () => {
    const secret = generateTotpSecret()
    const now = Date.now()
    const step = Math.floor(now / 30000)
    const code = totpAt(secret, step)
    expect(verifyTotp(secret, code, { now, lastStep: step })).toBeNull()
  })

  it('rejects malformed codes', () => {
    const secret = generateTotpSecret()
    for (const bad of ['', '12345', '1234567', 'abcdef', null, undefined]) {
      expect(verifyTotp(secret, bad)).toBeNull()
    }
  })

  it('builds an authenticator URL', () => {
    expect(otpauthUrl('ABC', 'a@b.c')).toBe('otpauth://totp/PGBook%20Admin%3Aa%40b.c?secret=ABC&issuer=PGBook%20Admin&algorithm=SHA1&digits=6&period=30')
    expect(hotp(base32Decode(RFC_SECRET), 0)).toBe('755224') // RFC 4226 HOTP vector
  })
})

describe('secretBox', () => {
  it('encrypts, decrypts and detects tampering', async () => {
    const { seal, open, createToken, hashToken } = await import('./secretBox.js')
    const sealed = seal('JBSWY3DPEHPK3PXP')
    expect(sealed).not.toContain('JBSWY3DPEHPK3PXP')
    expect(open(sealed)).toBe('JBSWY3DPEHPK3PXP')
    expect(seal('x')).not.toBe(seal('x')) // random IV
    const parts = sealed.split(':')
    parts[3] = parts[3].slice(0, -2) + (parts[3].endsWith('A') ? 'BB' : 'AA')
    expect(() => open(parts.join(':'))).toThrow()

    const { token, hash } = createToken()
    expect(hashToken(token)).toBe(hash)
    expect(hash).not.toContain(token)
  })
})

describe('policy', () => {
  const admin = role => ({ realm: 'admin', role })
  it('gives each admin role only its capabilities', () => {
    expect(can(admin('super_admin'), 'orgs.suspend')).toBe(true)
    expect(can(admin('support_agent'), 'orgs.suspend')).toBe(false)
    expect(can(admin('support_agent'), 'orgs.requestSuspend')).toBe(true)
    expect(can(admin('analyst'), 'orgs.view')).toBe(false)
    expect(can(admin('analyst'), 'platform.view')).toBe(true)
    expect(can(admin('billing_admin'), 'admins.request')).toBe(false)
    expect(can(admin('nobody'), 'platform.view')).toBe(false)
    expect(can(null, 'platform.view')).toBe(false)
  })

  it('never lets one realm use another realm\'s capabilities', () => {
    expect(can({ realm: 'org', role: 'owner' }, 'tenants.manage')).toBe(true)
    expect(can({ realm: 'org', role: 'super_admin' }, 'orgs.suspend')).toBe(false)
    expect(can({ realm: 'resident', role: 'owner' }, 'tenants.manage')).toBe(false)
  })

  it('caps trial extensions by role', () => {
    expect(maxTrialExtension(admin('support_agent'))).toBe(14)
    expect(maxTrialExtension(admin('billing_admin'))).toBe(90)
    expect(maxTrialExtension(admin('analyst'))).toBe(0)
  })
})

describe('audit redaction', () => {
  it('hides amounts and tenant names of owner business events from admins', async () => {
    const { redactForAdmin } = await import('./audit.js')
    const ownerEvent = { action: 'payment.record', actor: { realm: 'org', name: 'Owner' }, target: { kind: 'payment', label: 'Ravi (Room 1)' }, details: { amount: 5000, method: 'upi', month: '2026-10' } }
    const redacted = redactForAdmin(ownerEvent)
    expect(redacted.target).toEqual({ kind: 'payment' })
    expect(redacted.details).toBeUndefined()
    expect(describeEvent(redacted)).toBe('Recorded a payment')
    expect(describeEvent(ownerEvent)).toBe('Recorded ₹5,000 (UPI) from Ravi (Room 1) — October 2026')
    expect(describeEvent({ ...ownerEvent, details: { amount: 5000 } })).toBe('Recorded ₹5,000 from Ravi (Room 1)')

    const adminEvent = { action: 'org.suspended', actor: { realm: 'admin', name: 'Asha' }, target: { kind: 'org', label: 'Kumar PG' }, reason: 'Fraud report' }
    expect(redactForAdmin(adminEvent).target.label).toBe('Kumar PG')

    const signIn = { action: 'auth.login', actor: { realm: 'org', name: 'Owner' } }
    expect(redactForAdmin(signIn).redacted).toBeUndefined()
  })
})

describe('payout UPI change', () => {
  it('tells admins it changed without revealing the UPI ID', async () => {
    const { redactForAdmin } = await import('./audit.js')
    const event = { action: 'settings.payout_upi_changed', actor: { realm: 'org', name: 'Owner' }, details: { from: 'old@upi', to: 'new@upi' } }
    const view = redactForAdmin(event)
    expect(view.details).toBeUndefined()
    expect(describeEvent(view)).toBe('Changed payout UPI ID')
    expect(describeEvent(event)).toBe('Changed payout UPI ID from "old@upi" to "new@upi"')
  })
})
