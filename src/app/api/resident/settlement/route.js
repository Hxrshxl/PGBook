import DepositSettlement from '@/lib/models/DepositSettlement'
import { json } from '@/lib/api'
import { residentRoute } from '@/lib/residentApi'
import { settlementView, VISIBLE_SETTLEMENT } from '@/lib/residentData'

// The deposit settlement, once the PG has shared it. Former tenants keep access.
export const GET = residentRoute(async ({ tenant }) => {
  const s = await DepositSettlement.findOne({ tenantId: tenant._id, status: { $in: VISIBLE_SETTLEMENT } }).sort({ createdAt: -1 })
  return json({ settlement: s ? settlementView(s) : null, deposit: tenant.depositAmount })
})
