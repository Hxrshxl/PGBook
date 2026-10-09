import Tenant from '@/lib/models/Tenant'
import Property from '@/lib/models/Property'
import { route, json, ApiError, assertObjectId } from '@/lib/api'
import { tenantTarget } from '@/lib/auditTargets'

// A WhatsApp message inviting a tenant to the app. Sign-in is by the phone number on
// record, so the link carries no secret and can be shared again safely.
export const POST = route(async ({ request, params, scope, audit }) => {
  assertObjectId(params.id, 'Tenant')
  const tenant = await Tenant.findOne({ _id: params.id, ...scope.filter() })
  if (!tenant) throw new ApiError(404, 'Tenant not found.')
  if (tenant.status !== 'active') throw new ApiError(409, 'Only current tenants can be invited.')
  const property = tenant.propertyId ? await Property.findById(tenant.propertyId).select('name') : null
  const base = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin
  const url = `${base}/t`
  const message = `Hi ${tenant.name.split(' ')[0]}, you can now see your rent, pay by UPI, get receipts and raise complaints for ${property?.name ?? 'our PG'} on the PGBook app: ${url}\nSign in with this mobile number (${tenant.phone}) — you'll get a one-time code.`
  tenant.portalInvitedAt = new Date()
  await tenant.save()
  await audit('tenant.invited_to_app', { target: tenantTarget(tenant) })
  return json({ url, message, phone: tenant.phone })
}, { permission: 'tenants.manage' })
