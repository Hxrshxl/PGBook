// Actions PGBook admins can take on an owner's account. Used both directly and
// when an approval request executes, so the rules live in exactly one place.
import mongoose from 'mongoose'
import User from './models/User.js'
import { ApiError } from './api'
import { recordAudit } from './audit'
import { ADMIN_ROLES, maxTrialExtension } from './policy'

export async function findOrg(id) {
  if (!mongoose.isValidObjectId(id)) throw new ApiError(404, 'Owner account not found.')
  const user = await User.findById(id)
  if (!user) throw new ApiError(404, 'Owner account not found.')
  return user
}

const orgTarget = user => ({ kind: 'org', id: user._id.toString(), label: `${user.name} · ${user.pgSettings?.pgName || user.email}` })

function requireReason(reason) {
  if (typeof reason !== 'string' || reason.trim().length < 3) throw new ApiError(400, 'Please give a reason (it is kept in the audit log).')
  return reason.trim()
}

export async function suspendOrg(user, { reason, actor, request }) {
  const why = requireReason(reason)
  if (user.status === 'suspended') throw new ApiError(409, 'This account is already suspended.')
  user.status = 'suspended'
  user.suspension = { at: new Date(), reason: why, by: `${actor.name} (${ADMIN_ROLES[actor.role] ?? actor.role})` }
  user.tokenVersion = (user.tokenVersion ?? 0) + 1 // ends every active session immediately
  await recordAudit({ actor, action: 'org.suspended', orgId: user._id, target: orgTarget(user), reason: why, request }, { critical: true })
  await user.save()
  return user
}

export async function reactivateOrg(user, { reason, actor, request }) {
  const why = requireReason(reason)
  if (user.status !== 'suspended') throw new ApiError(409, 'This account is not suspended.')
  user.status = 'active'
  user.suspension = null
  await recordAudit({ actor, action: 'org.reactivated', orgId: user._id, target: orgTarget(user), reason: why, request }, { critical: true })
  await user.save()
  return user
}

export async function extendTrial(user, { days, reason, actor, request }) {
  const why = requireReason(reason)
  const n = Number(days)
  const max = maxTrialExtension(actor)
  if (!Number.isInteger(n) || n < 1) throw new ApiError(400, 'Days must be a whole number of at least 1.')
  if (n > max) throw new ApiError(403, `Your role can extend a trial by at most ${max} days at a time.`)
  if (user.plan !== 'trial') throw new ApiError(409, 'This account is on a paid plan, so there is no trial to extend.')

  const from = Math.max(Date.now(), user.effectiveTrialEnd().getTime())
  const previous = user.effectiveTrialEnd()
  user.trialEndsAt = new Date(from + n * 86400000)
  await recordAudit({
    actor, action: 'org.trial_extended', orgId: user._id, target: orgTarget(user), reason: why, request,
    details: { days: n, from: previous.toISOString(), to: user.trialEndsAt.toISOString() },
  }, { critical: true })
  await user.save()
  return user
}

export async function forceLogoutOrg(user, { reason, actor, request }) {
  const why = requireReason(reason)
  user.tokenVersion = (user.tokenVersion ?? 0) + 1
  await recordAudit({ actor, action: 'org.force_logout', orgId: user._id, target: orgTarget(user), reason: why, request }, { critical: true })
  await user.save()
  return user
}
