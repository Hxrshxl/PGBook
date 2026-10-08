import PlatformAdmin from '@/lib/models/PlatformAdmin'
import ApprovalRequest from '@/lib/models/ApprovalRequest'
import { readJson, json, ApiError } from '@/lib/api'
import { adminRoute } from '@/lib/adminApi'
import { ADMIN_ROLES, ADMIN_ROLE_DESCRIPTIONS, can } from '@/lib/policy'
import { approvalView, createApproval, expireStaleApprovals } from '@/lib/approvals'

const TEAM_REQUESTS = { invite: 'admin.invite', changeRole: 'admin.changeRole', disable: 'admin.disable', enable: 'admin.enable', reset2fa: 'admin.reset2fa' }

export const GET = adminRoute(async ({ actor }) => {
  await expireStaleApprovals()
  const [admins, pending] = await Promise.all([
    PlatformAdmin.find({}).sort({ status: 1, createdAt: 1 }),
    ApprovalRequest.find({ status: 'pending', type: /^admin\./ }).sort({ createdAt: -1 }),
  ])
  return json({
    admins: admins.map(a => ({ ...a.toJSON(), roleLabel: ADMIN_ROLES[a.role], inviteExpired: a.status === 'invited' && (!a.inviteExpiresAt || a.inviteExpiresAt < new Date()) })),
    pending: pending.map(a => approvalView(a, actor)),
    roles: Object.entries(ADMIN_ROLES).map(([id, label]) => ({ id, label, description: ADMIN_ROLE_DESCRIPTIONS[id] })),
    canRequest: can(actor, 'admins.request'),
    isSuperAdmin: actor.role === 'super_admin',
  })
}, { permission: 'admins.view' })

// Every change to the admin team is a request that another Super Admin must approve.
export const POST = adminRoute(async ({ request, actor }) => {
  const { type, reason, ...payload } = await readJson(request)
  const approvalType = TEAM_REQUESTS[type]
  if (!approvalType) throw new ApiError(400, 'Unknown request type.')
  const approval = await createApproval({ type: approvalType, payload, reason, actor, request })
  return json({ approval: approvalView(approval, actor) }, 201)
}, { permission: 'admins.request' })
