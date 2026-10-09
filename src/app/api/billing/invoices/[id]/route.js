import Invoice from '@/lib/models/Invoice'
import { route, json, assertObjectId, ApiError } from '@/lib/api'

export const GET = route(async ({ params, org }) => {
  assertObjectId(params.id, 'Invoice')
  const invoice = await Invoice.findOne({ _id: params.id, orgId: org._id })
  if (!invoice) throw new ApiError(404, 'Invoice not found.')
  return json(invoice)
}, { permission: 'billing.manage' })
