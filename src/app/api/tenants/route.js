import Tenant from '@/lib/models/Tenant'
import { route, readJson, json, APP_TIME_ZONE } from '@/lib/api'
import { tenantInput } from '@/lib/tenantFields'
import { ensureDue } from '@/lib/billing'
import { tenantTarget } from '@/lib/auditTargets'
import { getCurrentMonth, isBillableMonth } from '@/utils/helpers'

export const GET = route(async ({ user }) => {
  const tenants = await Tenant.find({ userId: user._id }).sort({ createdAt: 1 })
  return json(tenants)
}, { permission: 'tenants.view' })

// Creates the tenant and, if they are already living there, this month's dues.
export const POST = route(async ({ request, user, audit }) => {
  const body = await readJson(request)
  const tenant = await Tenant.create({ ...tenantInput(body), userId: user._id, status: 'active' })

  const month = getCurrentMonth(APP_TIME_ZONE)
  const payment = isBillableMonth(tenant.moveInDate, month) ? await ensureDue(user._id, tenant, month) : null
  await audit('tenant.create', { target: tenantTarget(tenant), details: { rent: tenant.rentAmount, moveInDate: tenant.moveInDate } })
  return json({ tenant, payment }, 201)
}, { permission: 'tenants.manage' })
