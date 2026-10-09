import mongoose from 'mongoose'
import { ACTOR_REALMS } from './models/AuditEvent.js'

const escapeRegex = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Builds a Mongo filter from the audit explorer's query string. */
export function auditFilter(params) {
  const filter = {}
  const realm = params.get('realm')
  if (ACTOR_REALMS.includes(realm)) filter['actor.realm'] = realm

  const action = params.get('action')?.trim()
  if (action) filter.action = new RegExp(`^${escapeRegex(action.slice(0, 60))}`)

  const orgId = params.get('orgId')?.trim()
  if (orgId && mongoose.isValidObjectId(orgId)) filter.orgId = new mongoose.Types.ObjectId(orgId)

  const actor = params.get('actor')?.trim()
  if (actor) filter['actor.name'] = new RegExp(escapeRegex(actor.slice(0, 60)), 'i')

  const from = params.get('from')
  const to = params.get('to')
  const range = {}
  if (from && !Number.isNaN(Date.parse(from))) range.$gte = new Date(`${from}T00:00:00+05:30`)
  if (to && !Number.isNaN(Date.parse(to))) range.$lte = new Date(`${to}T23:59:59.999+05:30`)
  if (Object.keys(range).length) filter.createdAt = range
  return filter
}
