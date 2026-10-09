import { route, readJson, json } from '@/lib/api'
import { capabilitiesFor } from '@/lib/policy'
import { markRead, orgNotifications } from '@/lib/notify'

export const GET = route(async ({ user, org, actor }) => {
  const list = await orgNotifications({ orgId: org._id, userId: user._id, capabilities: capabilitiesFor(actor) })
  return json({ notifications: list, unread: list.filter(n => !n.read).length })
})

// Mark some (ids) or all as read.
export const POST = route(async ({ request, user, org, actor }) => {
  const { ids } = await readJson(request)
  await markRead({ audience: 'org', orgId: org._id, capability: { $in: [...capabilitiesFor(actor), null] } }, user._id, ids)
  return json({ ok: true })
}, { readOnlyOk: true })
