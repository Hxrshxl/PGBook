import jwt from 'jsonwebtoken'

const SECRET = process.env.JWT_SECRET || 'dev_fallback_secret'

export function signToken(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: '30d' })
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, SECRET)
  } catch {
    return null
  }
}

export function getUserFromRequest(request) {
  const auth = request.headers.get('authorization') ?? ''
  if (!auth.startsWith('Bearer ')) return null
  return verifyToken(auth.slice(7))
}
