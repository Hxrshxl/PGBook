import mongoose from 'mongoose'
import Membership, { STAFF_ROLES } from './models/Membership.js'
import Property from './models/Property.js'
import { ApiError } from './api.js'
import { createToken } from './secretBox.js'

export const STAFF_INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000

/** Validates a role and a list of property ids belonging to the organization (empty = all). */
export async function validateAccess(orgId, { role, propertyIds }) {
  if (!STAFF_ROLES.includes(role)) throw new ApiError(400, 'Role must be manager, accountant or caretaker.')
  const ids = Array.isArray(propertyIds) ? [...new Set(propertyIds.map(String))] : []
  if (!ids.every(id => mongoose.isValidObjectId(id))) throw new ApiError(400, 'Invalid property selection.')
  if (ids.length) {
    const found = await Property.countDocuments({ orgId, _id: { $in: ids }, status: 'active' })
    if (found !== ids.length) throw new ApiError(400, 'Some selected properties were not found.')
  }
  return { role, propertyIds: ids }
}

export async function issueStaffInvite(membership, request) {
  const { token, hash } = createToken()
  membership.inviteTokenHash = hash
  membership.inviteExpiresAt = new Date(Date.now() + STAFF_INVITE_TTL_MS)
  await membership.save()
  const base = process.env.NEXT_PUBLIC_SITE_URL || (request ? new URL(request.url).origin : '')
  return `${base}/join?token=${token}`
}

export async function findMember(orgId, id) {
  if (!mongoose.isValidObjectId(id)) throw new ApiError(404, 'Team member not found.')
  const member = await Membership.findOne({ _id: id, orgId, status: { $ne: 'removed' } })
  if (!member) throw new ApiError(404, 'Team member not found.')
  return member
}

export const memberTarget = m => ({ kind: 'member', id: m._id.toString(), label: `${m.name} <${m.email}>` })
