import { route, readJson, json, pick } from '@/lib/api'
import { billingOverview } from '@/lib/billingView'

// The owner's subscription: status, usage vs limits, plans they can choose, invoices.
export const GET = route(async ({ request, org }) => json(await billingOverview(org, request)), { permission: 'billing.manage' })

// Who invoices are addressed to (business name, GSTIN, address, state).
export const PUT = route(async ({ request, org, audit }) => {
  const body = await readJson(request)
  const details = pick(body, ['legalName', 'gstin', 'address', 'stateCode', 'email'])
  for (const [k, v] of Object.entries(details)) org.set(`billing.details.${k}`, typeof v === 'string' ? v.trim() : v)
  await org.save()
  await audit('billing.details_updated', { details: { fields: Object.keys(details) } })
  return json(await billingOverview(org, request))
}, { permission: 'billing.manage', readOnlyOk: true })
