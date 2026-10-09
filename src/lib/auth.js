import { SignJWT, jwtVerify } from 'jose'

// Each realm has its own cookie and JWT audience, so a token issued for one
// realm can never be replayed in another.
export const SESSION_COOKIE = 'pgbook_session'      // owners (org realm)
export const ADMIN_COOKIE = 'pgbook_admin'          // PGBook staff
export const ADMIN_PRE_COOKIE = 'pgbook_admin_pre'  // password OK, 2FA still pending
export const RESIDENT_COOKIE = 'pgbook_resident'    // tenants (phone login)

const ORG_AUDIENCE = 'org'
const ADMIN_AUDIENCE = 'admin'
const ADMIN_PRE_AUDIENCE = 'admin-pre'
const RESIDENT_AUDIENCE = 'resident'

const SESSION_MAX_AGE = 60 * 60 * 24 * 30   // 30 days
export const ADMIN_SESSION_MAX_AGE = 60 * 60 * 8 // 8 hours
const ADMIN_PRE_MAX_AGE = 60 * 10          // 10 minutes to enter the 2FA code
const RESIDENT_SESSION_MAX_AGE = 60 * 60 * 24 * 30 // 30 days

function getSecret() {
  const secret = process.env.JWT_SECRET
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET must be set to a random string of at least 32 characters (see .env.example)')
  }
  return new TextEncoder().encode(secret)
}

function sign(claims, { subject, audience, maxAge }) {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(subject)
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime(`${maxAge}s`)
    .sign(getSecret())
}

// ── Owners ────────────────────────────────────────────────────

export async function signToken({ id, tokenVersion = 0 }) {
  return sign({ v: tokenVersion }, { subject: id, audience: ORG_AUDIENCE, maxAge: SESSION_MAX_AGE })
}

/** Returns { id, tokenVersion } for a valid owner token, or null. */
export async function verifyToken(token) {
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: ['HS256'] })
    // Tokens issued before audiences existed have no `aud` and are owner sessions.
    if (payload.aud !== undefined && payload.aud !== ORG_AUDIENCE) return null
    if (!payload.sub) return null
    return { id: payload.sub, tokenVersion: payload.v ?? 0 }
  } catch {
    return null
  }
}

export function getTokenFromRequest(request) {
  const cookie = request.cookies?.get(SESSION_COOKIE)?.value
  if (cookie) return cookie
  const header = request.headers.get('authorization') ?? ''
  return header.startsWith('Bearer ') ? header.slice(7) : null
}

export function setSessionCookie(response, token) {
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  })
  return response
}

export function clearSessionCookie(response) {
  response.cookies.set(SESSION_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 })
  return response
}

// ── Residents (tenant app) ────────────────────────────────────

export async function signResidentToken({ id, tokenVersion = 0 }) {
  return sign({ v: tokenVersion }, { subject: id, audience: RESIDENT_AUDIENCE, maxAge: RESIDENT_SESSION_MAX_AGE })
}

export async function verifyResidentToken(token) {
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: ['HS256'], audience: RESIDENT_AUDIENCE })
    return payload.sub ? { id: payload.sub, tokenVersion: payload.v ?? 0 } : null
  } catch {
    return null
  }
}

export function setResidentCookie(response, token) {
  response.cookies.set(RESIDENT_COOKIE, token, {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: RESIDENT_SESSION_MAX_AGE,
  })
  return response
}

export function clearResidentCookie(response) {
  response.cookies.set(RESIDENT_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 })
  return response
}

// ── PGBook admins ─────────────────────────────────────────────

export async function signAdminToken({ id, tokenVersion = 0 }) {
  return sign({ v: tokenVersion }, { subject: id, audience: ADMIN_AUDIENCE, maxAge: ADMIN_SESSION_MAX_AGE })
}

export async function verifyAdminToken(token) {
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: ['HS256'], audience: ADMIN_AUDIENCE })
    if (!payload.sub) return null
    return { id: payload.sub, tokenVersion: payload.v ?? 0 }
  } catch {
    return null
  }
}

/** Short-lived proof that the password step passed; purpose is 'totp' or 'enroll'. */
export async function signAdminPreToken({ id, purpose }) {
  return sign({ p: purpose }, { subject: id, audience: ADMIN_PRE_AUDIENCE, maxAge: ADMIN_PRE_MAX_AGE })
}

export async function verifyAdminPreToken(token) {
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: ['HS256'], audience: ADMIN_PRE_AUDIENCE })
    return payload.sub ? { id: payload.sub, purpose: payload.p } : null
  } catch {
    return null
  }
}

const adminCookieOptions = maxAge => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  path: '/',
  maxAge,
})

export function setAdminSessionCookie(response, token) {
  response.cookies.set(ADMIN_COOKIE, token, adminCookieOptions(ADMIN_SESSION_MAX_AGE))
  return response
}

export function clearAdminSessionCookie(response) {
  response.cookies.set(ADMIN_COOKIE, '', adminCookieOptions(0))
  return response
}

export function setAdminPreCookie(response, token) {
  response.cookies.set(ADMIN_PRE_COOKIE, token, adminCookieOptions(ADMIN_PRE_MAX_AGE))
  return response
}

export function clearAdminPreCookie(response) {
  response.cookies.set(ADMIN_PRE_COOKIE, '', adminCookieOptions(0))
  return response
}
