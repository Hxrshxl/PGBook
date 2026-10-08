import mongoose from 'mongoose'
import PlatformAdmin from '@/lib/models/PlatformAdmin'
import { json, ApiError } from '@/lib/api'
import { adminRoute } from '@/lib/adminApi'
import { issueInvite } from '@/lib/approvals'

// A fresh single-use link for an already-approved invite (the old link stops working).
// The invite itself was approved, so this needs a Super Admin plus a fresh 2FA code, not another approval.
export const POST = adminRoute(async ({ request, params, actor, audit }) => {
  if (actor.role !== 'super_admin') throw new ApiError(403, 'Only a Super Admin can issue invite links.')
  if (!mongoose.isValidObjectId(params.id)) throw new ApiError(404, 'Admin not found.')
  const admin = await PlatformAdmin.findById(params.id)
  if (!admin) throw new ApiError(404, 'Admin not found.')
  if (admin.status !== 'invited') throw new ApiError(409, 'This admin has already accepted their invite.')
  const inviteUrl = await issueInvite(admin, request)
  await audit('admin.invite_link_issued', { target: { kind: 'admin', id: params.id, label: `${admin.name} <${admin.email}>` } })
  return json({ inviteUrl })
}, { permission: 'admins.request', stepUp: true })
