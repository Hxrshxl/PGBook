import Membership from '@/lib/models/Membership'
import User from '@/lib/models/User'
import { route, readJson, json, ApiError } from '@/lib/api'
import { issueStaffInvite, memberTarget, validateAccess } from '@/lib/team'
import { ORG_ROLES, ORG_ROLE_DESCRIPTIONS } from '@/lib/policy'

export const GET = route(async ({ org }) => {
  const members = await Membership.find({ orgId: org._id, status: { $ne: 'removed' } }).sort({ createdAt: 1 })
  const users = new Map((await User.find({ _id: { $in: members.map(m => m.userId).filter(Boolean) } }).select('lastLoginAt lastActiveAt')).map(u => [u._id.toString(), u]))
  return json({
    members: members.map(m => {
      const u = m.userId ? users.get(m.userId.toString()) : null
      return {
        ...m.toJSON(),
        roleLabel: ORG_ROLES[m.role],
        lastActiveAt: u?.lastActiveAt ?? null,
        inviteExpired: m.status === 'invited' && (!m.inviteExpiresAt || m.inviteExpiresAt < new Date()),
      }
    }),
    roles: Object.entries(ORG_ROLE_DESCRIPTIONS).map(([id, description]) => ({ id, label: ORG_ROLES[id], description })),
  })
}, { permission: 'team.manage' })

// Invite a staff member. Returns a single-use link (valid 7 days) for the owner to share.
export const POST = route(async ({ request, org, audit }) => {
  const body = await readJson(request)
  const name = String(body.name ?? '').trim()
  const email = String(body.email ?? '').toLowerCase().trim()
  if (!name) throw new ApiError(400, 'Name is required.')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ApiError(400, 'Please enter a valid email address.')
  const access = await validateAccess(org._id, body)

  if (email === org.email) throw new ApiError(400, "That's your own email.")
  const existingUser = await User.findOne({ email }).select('kind')
  if (existingUser?.kind === 'owner') {
    throw new ApiError(409, 'This email already has its own PGBook owner account. Ask them to use a different email for staff access.')
  }
  if (await Membership.exists({ email, status: { $in: ['invited', 'active'] } })) {
    throw new ApiError(409, 'This person is already invited to or working in a PGBook account.')
  }

  const member = new Membership({ orgId: org._id, name, email, ...access, status: 'invited', invitedBy: org.name })
  const inviteUrl = await issueStaffInvite(member, request)
  await audit('team.invited', { target: memberTarget(member), details: { role: member.role, properties: access.propertyIds.length || 'all' } })
  return json({ member: { ...member.toJSON(), roleLabel: ORG_ROLES[member.role] }, inviteUrl }, 201)
}, { permission: 'team.manage' })
