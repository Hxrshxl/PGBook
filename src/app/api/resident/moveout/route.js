import MoveOutRequest from '@/lib/models/MoveOutRequest'
import { readJson, json, ApiError, APP_TIME_ZONE } from '@/lib/api'
import { residentRoute } from '@/lib/residentApi'
import { notifyOrg } from '@/lib/notify'
import { formatDate, isValidDate, todayISO } from '@/utils/helpers'

const addDays = (iso, n) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10)

// Give move-out notice. A date earlier than the notice period is allowed but shown
// to the owner as short notice (it may affect the deposit).
export const POST = residentRoute(async ({ request, tenant, org, property, audit }) => {
  const { moveOutDate, reason = '' } = await readJson(request)
  const today = todayISO(APP_TIME_ZONE)
  if (!isValidDate(moveOutDate) || moveOutDate < today) throw new ApiError(400, 'Choose a move-out date from today onwards.')
  if (await MoveOutRequest.exists({ tenantId: tenant._id, status: { $in: ['pending', 'acknowledged'] } })) {
    throw new ApiError(409, 'You have already given notice. Withdraw it first to change the date.')
  }
  const earliestDate = addDays(today, property?.noticePeriodDays ?? 30)
  const request_ = await MoveOutRequest.create({
    orgId: org._id, propertyId: tenant.propertyId, tenantId: tenant._id, residentId: tenant.residentId,
    tenantName: tenant.name, room: tenant.room, moveOutDate, earliestDate, reason: String(reason).trim(),
  })
  const short = moveOutDate < earliestDate
  await audit('moveout.requested', { target: { kind: 'tenant', id: tenant._id.toString(), label: tenant.name }, details: { moveOutDate, shortNotice: short } })
  await notifyOrg({
    orgId: org._id, capability: 'tenants.manage', type: 'moveout.requested', tone: short ? 'warning' : 'info', link: '/dashboard/approvals',
    title: `${tenant.name} (Room ${tenant.room}) gave move-out notice`,
    body: `Moving out on ${formatDate(moveOutDate)}${short ? ` — shorter than the ${property?.noticePeriodDays ?? 30}-day notice period` : ''}. Acknowledge it in Approvals.`,
  })
  return json({ id: request_._id.toString(), moveOutDate, earliestDate, shortNotice: short, status: request_.status }, 201)
}, { write: true })
