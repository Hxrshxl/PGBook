import { route, json, ApiError } from '@/lib/api'
import { findMember, issueStaffInvite, memberTarget } from '@/lib/team'

// A fresh single-use invite link (the previous one stops working).
export const POST = route(async ({ request, params, org, audit }) => {
  const member = await findMember(org._id, params.id)
  if (member.status !== 'invited') throw new ApiError(409, 'This person has already joined.')
  const inviteUrl = await issueStaffInvite(member, request)
  await audit('team.invite_link_issued', { target: memberTarget(member) })
  return json({ inviteUrl })
}, { permission: 'team.manage' })
