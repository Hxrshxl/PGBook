import User from '@/lib/models/User'
import { route, readJson, json } from '@/lib/api'
import { findMember, memberTarget, validateAccess } from '@/lib/team'
import { ORG_ROLES } from '@/lib/policy'

// Change a member's role or which properties they can access. Takes effect on their next request.
export const PUT = route(async ({ request, params, org, audit }) => {
  const member = await findMember(org._id, params.id)
  const body = await readJson(request)
  const access = await validateAccess(org._id, { role: body.role ?? member.role, propertyIds: body.propertyIds ?? member.propertyIds })
  const before = { role: member.role, properties: member.propertyIds.length }
  member.role = access.role
  member.propertyIds = access.propertyIds
  await member.save()
  await audit('team.updated', {
    target: memberTarget(member),
    details: { roleFrom: before.role, roleTo: member.role, propertiesFrom: before.properties || 'all', propertiesTo: access.propertyIds.length || 'all' },
  })
  return json({ ...member.toJSON(), roleLabel: ORG_ROLES[member.role] })
}, { permission: 'team.manage' })

// Remove access immediately: the membership ends and their sessions are signed out.
export const DELETE = route(async ({ params, org, audit }) => {
  const member = await findMember(org._id, params.id)
  member.status = 'removed'
  member.removedAt = new Date()
  member.inviteTokenHash = null
  await member.save()
  if (member.userId) await User.updateOne({ _id: member.userId }, { $inc: { tokenVersion: 1 } })
  await audit('team.removed', { target: memberTarget(member), details: { role: member.role } })
  return json({ ok: true })
}, { permission: 'team.manage' })
