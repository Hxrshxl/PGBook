// In-app notifications (plus email for the owner on billing matters).
import mongoose from 'mongoose'
import Notification from './models/Notification.js'
import User from './models/User.js'
import { sendEmail } from './messaging.js'

const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

/**
 * Notifies an organization. Everyone with `capability` sees it (billing.manage = the owner).
 * With a `key`, the same notification is only ever created once (scheduled reminders).
 * Returns the notification, or null if it already existed.
 */
export async function notifyOrg({ orgId, capability = 'billing.manage', type, title, body = '', link = '', tone = 'info', key, email = false }) {
  try {
    // The unique index on key is the real guarantee; this check also covers a fresh
    // database where the index is still being built.
    if (key && await Notification.exists({ key })) return null
    const n = await Notification.create({ audience: 'org', orgId, capability, type, title, body, link, tone, key })
    if (email) {
      const owner = await User.findById(orgId).select('email name billing.details.email')
      const to = owner?.billing?.details?.email || owner?.email
      await sendEmail({ to, subject: `PGBook: ${title}`, text: `Hi ${owner?.name ?? ''},\n\n${body}\n\n${link ? `${siteUrl()}${link}\n\n` : ''}— PGBook` })
    }
    return n
  } catch (err) {
    if (err?.code === 11000) return null // already sent
    console.error('[notify] org notification failed', type, err)
    return null
  }
}

export async function notifyResident({ residentId, orgId = null, type, title, body = '', link = '', tone = 'info', key }) {
  if (!residentId) return null
  try {
    if (key && await Notification.exists({ key })) return null
    return await Notification.create({ audience: 'resident', residentId, orgId, type, title, body, link, tone, key })
  } catch (err) {
    if (err?.code === 11000) return null
    console.error('[notify] resident notification failed', type, err)
    return null
  }
}

/** Notifications for an org user (by their capabilities), newest first. */
export async function orgNotifications({ orgId, userId, capabilities, limit = 30 }) {
  const list = await Notification.find({ audience: 'org', orgId, capability: { $in: [...capabilities, null] } })
    .sort({ createdAt: -1 }).limit(limit)
  return list.map(n => view(n, userId))
}

export async function residentNotifications({ residentId, limit = 30 }) {
  const list = await Notification.find({ audience: 'resident', residentId }).sort({ createdAt: -1 }).limit(limit)
  return list.map(n => view(n, residentId))
}

export async function markRead(filter, readerId, ids) {
  const query = { ...filter }
  if (Array.isArray(ids) && ids.length) query._id = { $in: ids.filter(id => mongoose.isValidObjectId(id)) }
  await Notification.updateMany(query, { $addToSet: { readBy: readerId } })
}

function view(n, readerId) {
  return {
    id: n._id.toString(), type: n.type, title: n.title, body: n.body, link: n.link, tone: n.tone, createdAt: n.createdAt,
    read: n.readBy.some(id => String(id) === String(readerId)),
  }
}
