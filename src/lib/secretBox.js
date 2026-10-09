// Authenticated encryption (AES-256-GCM) for small secrets stored in the database,
// e.g. admin 2FA seeds. Key: DATA_ENCRYPTION_KEY if set, otherwise derived from JWT_SECRET.
// Rotating the key makes existing secrets unreadable (admins would re-enrol 2FA).
import crypto from 'node:crypto'

function key() {
  const material = process.env.DATA_ENCRYPTION_KEY || process.env.JWT_SECRET
  if (!material || material.length < 32) {
    throw new Error('DATA_ENCRYPTION_KEY (or JWT_SECRET) must be at least 32 characters.')
  }
  return crypto.createHash('sha256').update(`pgbook-secret-box:${material}`).digest()
}

export function seal(plaintext) {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv)
  const data = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return ['v1', iv.toString('base64url'), tag.toString('base64url'), data.toString('base64url')].join(':')
}

export function open(sealed) {
  const [version, iv, tag, data] = String(sealed).split(':')
  if (version !== 'v1' || !iv || !tag || !data) throw new Error('Unrecognised sealed value.')
  const decipher = crypto.createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64url'))
  decipher.setAuthTag(Buffer.from(tag, 'base64url'))
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8')
}

/** Random URL-safe token and its SHA-256 hash (store only the hash). */
export function createToken(bytes = 32) {
  const token = crypto.randomBytes(bytes).toString('base64url')
  return { token, hash: hashToken(token) }
}

export function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex')
}
