// Maker-checker approvals. Each type declares who may request it, who may approve it,
// how its payload is validated, and what happens when it is approved.
import mongoose from 'mongoose'
import ApprovalRequest from './models/ApprovalRequest.js'
import PlatformAdmin from './models/PlatformAdmin.js'
import { ApiError } from './api'
import { recordAudit } from './audit'
import { ADMIN_ROLES, can } from './policy'
import { createToken } from './secretBox'
import { findOrg, reactivateOrg, suspendOrg } from './orgAdmin'

export const INVITE_TTL_MS = 72 * 60 * 60 * 1000

const isSuperAdmin = actor => actor.realm === 'admin' && actor.role === 'super_admin'

async function findAdmin(id) {
  if (!mongoose.isValidObjectId(id)) throw new ApiError(404, 'Admin not found.')
  const admin = await PlatformAdmin.findById(id)
  if (!admin) throw new ApiError(404, 'Admin not found.')
  return admin
}

/** Prevents locking everyone out: at least one other active Super Admin with 2FA must remain. */
async function assertAnotherSuperAdmin(excludingId) {
  const others = await PlatformAdmin.countDocuments({
    _id: { $ne: excludingId }, role: 'super_admin', status: 'active', totpEnabledAt: { $ne: null },
  })
  if (others === 0) throw new ApiError(409, 'This would leave no active Super Admin. Add another Super Admin first.')
}

function inviteUrl(request, token) {
  const base = process.env.NEXT_PUBLIC_SITE_URL || (request ? new URL(request.url).origin : '')
  return `${base}/admin/accept-invite?token=${token}`
}

export async function issueInvite(admin, request) {
  const { token, hash } = createToken()
  admin.inviteTokenHash = hash
  admin.inviteExpiresAt = new Date(Date.now() + INVITE_TTL_MS)
  await admin.save()
  return inviteUrl(request, token)
}

const adminLabel = a => `${a.name} <${a.email}>`

export const APPROVAL_TYPES = {
  'admin.invite': {
    label: 'Invite admin',
    canRequest: actor => can(actor, 'admins.request'),
    canApprove: isSuperAdmin,
    async prepare({ email, name, role }) {
      const normalized = String(email ?? '').toLowerCase().trim()
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) throw new ApiError(400, 'Please enter a valid email address.')
      if (!String(name ?? '').trim()) throw new ApiError(400, 'Name is required.')
      if (!ADMIN_ROLES[role]) throw new ApiError(400, 'Unknown admin role.')
      if (await PlatformAdmin.exists({ email: normalized })) throw new ApiError(409, 'An admin with this email already exists.')
      return { payload: { email: normalized, name: String(name).trim(), role }, summary: `Invite ${String(name).trim()} <${normalized}> as ${ADMIN_ROLES[role]}`, key: normalized }
    },
    async execute({ email, name, role }, { approval, actor, request }) {
      if (await PlatformAdmin.exists({ email })) throw new ApiError(409, 'An admin with this email already exists.')
      const admin = new PlatformAdmin({
        email, name, role, status: 'invited',
        invitedBy: { requestedBy: approval.requestedBy.name, approvedBy: actor.name },
      })
      const url = await issueInvite(admin, request)
      await recordAudit({ actor, action: 'admin.invited', target: { kind: 'admin', id: admin._id.toString(), label: adminLabel(admin) }, reason: approval.reason, details: { role, approvalId: approval._id.toString() }, request }, { critical: true })
      return { inviteUrl: url }
    },
  },

  'admin.changeRole': {
    label: 'Change admin role',
    canRequest: actor => can(actor, 'admins.request'),
    canApprove: isSuperAdmin,
    async prepare({ adminId, role }) {
      const admin = await findAdmin(adminId)
      if (!ADMIN_ROLES[role]) throw new ApiError(400, 'Unknown admin role.')
      if (admin.role === role) throw new ApiError(409, `${admin.name} is already a ${ADMIN_ROLES[role]}.`)
      return { payload: { adminId: admin._id.toString(), role, fromRole: admin.role }, summary: `Change ${adminLabel(admin)} from ${ADMIN_ROLES[admin.role]} to ${ADMIN_ROLES[role]}`, key: admin._id.toString() }
    },
    async execute({ adminId, role }, { approval, actor, request }) {
      const admin = await findAdmin(adminId)
      if (admin.role === 'super_admin' && role !== 'super_admin') await assertAnotherSuperAdmin(admin._id)
      const from = admin.role
      admin.role = role
      admin.tokenVersion += 1 // new permissions apply from a fresh sign-in
      await recordAudit({ actor, action: 'admin.role_changed', target: { kind: 'admin', id: adminId, label: adminLabel(admin) }, reason: approval.reason, details: { from, to: role, approvalId: approval._id.toString() }, request }, { critical: true })
      await admin.save()
      return {}
    },
  },

  'admin.disable': {
    label: 'Disable admin',
    canRequest: actor => can(actor, 'admins.request'),
    canApprove: isSuperAdmin,
    async prepare({ adminId }) {
      const admin = await findAdmin(adminId)
      if (admin.status === 'disabled') throw new ApiError(409, `${admin.name} is already disabled.`)
      return { payload: { adminId: admin._id.toString() }, summary: `Disable ${adminLabel(admin)}`, key: admin._id.toString() }
    },
    async execute({ adminId }, { approval, actor, request }) {
      const admin = await findAdmin(adminId)
      if (admin.role === 'super_admin') await assertAnotherSuperAdmin(admin._id)
      admin.status = 'disabled'
      admin.tokenVersion += 1
      await recordAudit({ actor, action: 'admin.disabled', target: { kind: 'admin', id: adminId, label: adminLabel(admin) }, reason: approval.reason, details: { approvalId: approval._id.toString() }, request }, { critical: true })
      await admin.save()
      return {}
    },
  },

  'admin.enable': {
    label: 'Re-enable admin',
    canRequest: actor => can(actor, 'admins.request'),
    canApprove: isSuperAdmin,
    async prepare({ adminId }) {
      const admin = await findAdmin(adminId)
      if (admin.status !== 'disabled') throw new ApiError(409, `${admin.name} is not disabled.`)
      return { payload: { adminId: admin._id.toString() }, summary: `Re-enable ${adminLabel(admin)}`, key: admin._id.toString() }
    },
    async execute({ adminId }, { approval, actor, request }) {
      const admin = await PlatformAdmin.findById(adminId).select('+password')
      if (!admin) throw new ApiError(404, 'Admin not found.')
      admin.status = admin.password ? 'active' : 'invited'
      await recordAudit({ actor, action: 'admin.enabled', target: { kind: 'admin', id: adminId, label: adminLabel(admin) }, reason: approval.reason, details: { approvalId: approval._id.toString() }, request }, { critical: true })
      await admin.save()
      return {}
    },
  },

  'admin.reset2fa': {
    label: 'Reset admin 2FA',
    canRequest: actor => can(actor, 'admins.request'),
    canApprove: isSuperAdmin,
    async prepare({ adminId }) {
      const admin = await findAdmin(adminId)
      if (!admin.totpEnabledAt) throw new ApiError(409, `${admin.name} has not set up 2FA yet.`)
      return { payload: { adminId: admin._id.toString() }, summary: `Reset two-factor authentication for ${adminLabel(admin)}`, key: admin._id.toString() }
    },
    async execute({ adminId }, { approval, actor, request }) {
      const admin = await PlatformAdmin.findById(adminId).select('+totpSecret +totpPendingSecret +lastTotpStep')
      if (!admin) throw new ApiError(404, 'Admin not found.')
      admin.totpSecret = null
      admin.totpPendingSecret = null
      admin.totpEnabledAt = null
      admin.lastTotpStep = -1
      admin.tokenVersion += 1 // they must sign in again and enrol a new authenticator
      await recordAudit({ actor, action: 'admin.2fa_reset', target: { kind: 'admin', id: adminId, label: adminLabel(admin) }, reason: approval.reason, details: { approvalId: approval._id.toString() }, request }, { critical: true })
      await admin.save()
      return {}
    },
  },

  'org.suspend': {
    label: 'Suspend owner account',
    canRequest: actor => can(actor, 'orgs.requestSuspend') || can(actor, 'orgs.suspend'),
    canApprove: actor => can(actor, 'orgs.suspend'),
    async prepare({ orgId }) {
      const user = await findOrg(orgId)
      if (user.status === 'suspended') throw new ApiError(409, 'This account is already suspended.')
      return { payload: { orgId: user._id.toString() }, summary: `Suspend ${user.name} (${user.pgSettings?.pgName || user.email})`, orgId: user._id, key: user._id.toString() }
    },
    async execute({ orgId }, { approval, actor, request }) {
      await suspendOrg(await findOrg(orgId), { reason: `${approval.reason} (requested by ${approval.requestedBy.name})`, actor, request })
      return {}
    },
  },

  'org.reactivate': {
    label: 'Reactivate owner account',
    canRequest: actor => can(actor, 'orgs.requestReactivate') || can(actor, 'orgs.reactivate'),
    canApprove: actor => can(actor, 'orgs.reactivate'),
    async prepare({ orgId }) {
      const user = await findOrg(orgId)
      if (user.status !== 'suspended') throw new ApiError(409, 'This account is not suspended.')
      return { payload: { orgId: user._id.toString() }, summary: `Reactivate ${user.name} (${user.pgSettings?.pgName || user.email})`, orgId: user._id, key: user._id.toString() }
    },
    async execute({ orgId }, { approval, actor, request }) {
      await reactivateOrg(await findOrg(orgId), { reason: `${approval.reason} (requested by ${approval.requestedBy.name})`, actor, request })
      return {}
    },
  },
}

function definition(type) {
  const def = APPROVAL_TYPES[type]
  if (!def) throw new ApiError(400, 'Unknown approval type.')
  return def
}

export async function expireStaleApprovals() {
  await ApprovalRequest.updateMany({ status: 'pending', expiresAt: { $lt: new Date() } }, { $set: { status: 'expired' } })
}

export async function createApproval({ type, payload, reason, actor, request }) {
  const def = definition(type)
  if (!def.canRequest(actor)) throw new ApiError(403, 'Your role cannot request this.')
  if (typeof reason !== 'string' || reason.trim().length < 3) throw new ApiError(400, 'Please give a reason for the approver.')
  await expireStaleApprovals()
  const prepared = await def.prepare(payload ?? {}, actor)

  const duplicate = await ApprovalRequest.exists({ type, status: 'pending', 'payload.key': prepared.key })
  if (duplicate) throw new ApiError(409, 'An identical request is already waiting for approval.')

  const approval = await ApprovalRequest.create({
    type,
    payload: { ...prepared.payload, key: prepared.key },
    summary: prepared.summary,
    reason: reason.trim(),
    requestedBy: { realm: actor.realm, id: actor.id, name: actor.name, role: actor.role },
    orgId: prepared.orgId ?? null,
  })
  await recordAudit({
    actor, action: 'approval.requested', orgId: approval.orgId, request, reason: approval.reason,
    target: { kind: 'approval', id: approval._id.toString(), label: approval.summary }, details: { type },
  }, { critical: true })
  return approval
}

export async function decideApproval({ id, decision, note = '', actor, request }) {
  if (!mongoose.isValidObjectId(id)) throw new ApiError(404, 'Request not found.')
  await expireStaleApprovals()
  const approval = await ApprovalRequest.findById(id)
  if (!approval) throw new ApiError(404, 'Request not found.')
  if (approval.status !== 'pending') throw new ApiError(409, `This request is already ${approval.status}.`)
  if (approval.requestedBy.id.toString() === actor.id.toString()) throw new ApiError(403, "You can't decide your own request — another admin must.")
  const def = definition(approval.type)
  if (!def.canApprove(actor)) throw new ApiError(403, 'Your role cannot approve this type of request.')
  if (!['approve', 'reject'].includes(decision)) throw new ApiError(400, 'Decision must be approve or reject.')
  if (decision === 'reject' && String(note).trim().length < 3) throw new ApiError(400, 'Please say why you are rejecting it.')

  approval.decidedBy = { realm: actor.realm, id: actor.id, name: actor.name, role: actor.role }
  approval.decidedAt = new Date()
  approval.decisionNote = String(note).trim()
  const target = { kind: 'approval', id: approval._id.toString(), label: approval.summary }

  if (decision === 'reject') {
    approval.status = 'rejected'
    await recordAudit({ actor, action: 'approval.rejected', orgId: approval.orgId, target, reason: approval.decisionNote, request }, { critical: true })
    await approval.save()
    return { approval, result: {} }
  }

  approval.status = 'approved'
  await recordAudit({ actor, action: 'approval.approved', orgId: approval.orgId, target, reason: approval.decisionNote, request }, { critical: true })
  await approval.save()

  // Execute with the approver as the actor, re-validating against current data.
  try {
    const result = await def.execute(approval.payload, { approval, actor, request })
    approval.executedAt = new Date()
    await approval.save()
    return { approval, result }
  } catch (err) {
    approval.status = 'failed'
    approval.error = err.message ?? 'Execution failed.'
    await approval.save()
    await recordAudit({ actor, action: 'approval.failed', orgId: approval.orgId, target, reason: approval.error, request })
    throw err instanceof ApiError ? err : new ApiError(500, 'Approved, but it could not be applied. See the request for details.')
  }
}

export async function cancelApproval({ id, actor, request }) {
  if (!mongoose.isValidObjectId(id)) throw new ApiError(404, 'Request not found.')
  const approval = await ApprovalRequest.findById(id)
  if (!approval) throw new ApiError(404, 'Request not found.')
  if (approval.requestedBy.id.toString() !== actor.id.toString()) throw new ApiError(403, 'Only the person who raised it can cancel it.')
  if (approval.status !== 'pending') throw new ApiError(409, `This request is already ${approval.status}.`)
  approval.status = 'cancelled'
  await recordAudit({ actor, action: 'approval.cancelled', orgId: approval.orgId, target: { kind: 'approval', id, label: approval.summary }, request }, { critical: true })
  await approval.save()
  return approval
}

/** Serialises a request for the console, including whether this admin may decide it. */
export function approvalView(approval, actor) {
  const json = approval.toJSON()
  const def = APPROVAL_TYPES[json.type]
  json.typeLabel = def?.label ?? json.type
  json.canDecide = json.status === 'pending' && json.requestedBy.id !== actor.id.toString() && !!def?.canApprove(actor)
  json.canCancel = json.status === 'pending' && json.requestedBy.id === actor.id.toString()
  delete json.payload?.key
  return json
}
