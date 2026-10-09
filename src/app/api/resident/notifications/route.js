import { json } from '@/lib/api'
import { residentRoute } from '@/lib/residentApi'
import { markRead, residentNotifications } from '@/lib/notify'

export const GET = residentRoute(async ({ resident }) => {
  const list = await residentNotifications({ residentId: resident._id })
  return json({ notifications: list, unread: list.filter(n => !n.read).length })
}, { stay: false })

export const POST = residentRoute(async ({ resident }) => {
  await markRead({ audience: 'resident', residentId: resident._id }, resident._id)
  return json({ ok: true })
}, { stay: false })
