import Membership from '@/lib/models/Membership'
import User, { PASSWORD_MIN_LENGTH } from '@/lib/models/User'
import Property from '@/lib/models/Property'
import { route, readJson, json, ApiError } from '@/lib/api'
import { signToken, setSessionCookie } from '@/lib/auth'
import { recordAudit } from '@/lib/audit'
import { hashToken } from '@/lib/secretBox'
import { rateLimit, clientIp } from '@/lib/rateLimit'
import { ORG_ROLES } from '@/lib/policy'
import { memberTarget } from '@/lib/team'

async function findInvite(token) {
  if (typeof token !== 'string' || token.length < 20) throw new ApiError(400, 'This invite link is not valid.')
  const member = await Membership.findOne({ inviteTokenHash: hashToken(token), status: 'invited' })
  if (!member || !member.inviteExpiresAt || member.inviteExpiresAt < new Date()) {
    throw new ApiError(410, 'This invite link has expired or was already used. Ask the owner for a new one.')
  }
  const org = await User.findById(member.orgId).select('name status')
  if (!org || org.status === 'suspended') throw new ApiError(410, 'This PG account is not available.')
  return { member, org }
}

export const GET = route(async ({ request }) => {
  const { member, org } = await findInvite(new URL(request.url).searchParams.get('token'))
  const property = await Property.findOne({ orgId: member.orgId, status: 'active' }).sort({ createdAt: 1 }).select('name')
  return json({ name: member.name, email: member.email, role: ORG_ROLES[member.role], owner: org.name, pgName: property?.name ?? '' })
}, { auth: false })

// Accepting creates the staff login and signs them in.
export const POST = route(async ({ request }) => {
  const limit = rateLimit(`join:${clientIp(request)}`, { limit: 10, windowMs: 15 * 60 * 1000 })
  if (!limit.ok) throw new ApiError(429, 'Too many attempts. Please wait a few minutes.')
  const { token, name, password } = await readJson(request)
  if (typeof password !== 'string' || password.length < PASSWORD_MIN_LENGTH || password.length > 128) {
    throw new ApiError(400, `Password must be ${PASSWORD_MIN_LENGTH}–128 characters.`)
  }
  const { member } = await findInvite(token)
  if (await User.exists({ email: member.email })) {
    throw new ApiError(409, 'An account with this email already exists. Ask the owner to invite a different email.')
  }

  const user = await User.create({ kind: 'staff', name: String(name ?? '').trim() || member.name, email: member.email, password, orgVersion: 1 })
  member.userId = user._id
  member.status = 'active'
  member.joinedAt = new Date()
  member.inviteTokenHash = null
  member.inviteExpiresAt = null
  await member.save()
  await recordAudit({ actor: { realm: 'org', id: user._id, name: user.name, role: member.role }, action: 'team.joined', orgId: member.orgId, target: memberTarget(member), request })

  const sessionToken = await signToken({ id: user._id.toString(), tokenVersion: user.tokenVersion })
  return setSessionCookie(json({ ok: true }, 201), sessionToken)
}, { auth: false })
