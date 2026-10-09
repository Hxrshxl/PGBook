import Tenant from '@/lib/models/Tenant'
import DepositSettlement from '@/lib/models/DepositSettlement'
import { route, json } from '@/lib/api'
import { roundMoney } from '@/utils/helpers'

const DAY = 86400000

// Deposits held, who is on notice or recently moved out, and settlements in progress.
export const GET = route(async ({ scope }) => {
  const [active, recentVacated, settlements] = await Promise.all([
    Tenant.find(scope.filter({ status: 'active' })).select('name room propertyId depositAmount noticeGivenAt expectedMoveOut residentId'),
    Tenant.find(scope.filter({ status: 'vacated', updatedAt: { $gte: new Date(Date.now() - 120 * DAY) } })).select('name room propertyId depositAmount moveOutDate'),
    DepositSettlement.find(scope.filter({ status: { $ne: 'cancelled' } }, 'orgId')).sort({ updatedAt: -1 }).limit(200),
  ])
  const openByTenant = new Set(settlements.filter(s => s.status !== 'closed').map(s => String(s.tenantId)))
  const closedByTenant = new Set(settlements.filter(s => s.status === 'closed').map(s => String(s.tenantId)))
  const row = t => ({ id: t._id.toString(), name: t.name, room: t.room, propertyId: t.propertyId?.toString() ?? null, deposit: t.depositAmount, hasSettlement: openByTenant.has(String(t._id)) })
  return json({
    held: roundMoney(active.reduce((s, t) => s + (t.depositAmount ?? 0), 0)),
    tenantsWithDeposit: active.filter(t => t.depositAmount > 0).length,
    onNotice: active.filter(t => t.noticeGivenAt).map(t => ({ ...row(t), expectedMoveOut: t.expectedMoveOut })),
    awaitingSettlement: recentVacated.filter(t => t.depositAmount > 0 && !closedByTenant.has(String(t._id))).map(t => ({ ...row(t), moveOutDate: t.moveOutDate })),
    settlements,
  })
}, { permission: 'deposits.view' })
