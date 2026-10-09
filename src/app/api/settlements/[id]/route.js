import DepositSettlement from '@/lib/models/DepositSettlement'
import { route, readJson, json, ApiError, assertObjectId, APP_TIME_ZONE } from '@/lib/api'
import { recordedBy } from '@/lib/paymentLookup'
import { cleanDeductions, closeSettlement, refreshSettlement } from '@/lib/settlements'
import { notifyOrg, notifyResident } from '@/lib/notify'
import { can } from '@/lib/policy'
import { formatCurrency, isValidDate, todayISO } from '@/utils/helpers'

async function findSettlement(scope, id) {
  assertObjectId(id, 'Settlement')
  const s = await DepositSettlement.findOne({ _id: id, ...scope.filter({}, 'orgId') })
  if (!s) throw new ApiError(404, 'Settlement not found.')
  return s
}
const target = s => ({ kind: 'tenant', id: String(s.tenantId), label: s.tenantName })
const EDITABLE = ['draft', 'pending_approval', 'shared', 'disputed']

// Edit deductions, notes or the date. Editing a shared/disputed settlement takes it back to
// draft: it has to be approved and shared again, so the tenant always sees the final numbers.
export const PUT = route(async ({ request, params, scope, audit }) => {
  const s = await findSettlement(scope, params.id)
  if (!EDITABLE.includes(s.status)) throw new ApiError(409, 'This settlement can no longer be changed.')
  const { deductions, notes, moveOutDate } = await readJson(request)
  if (deductions !== undefined) s.deductions = cleanDeductions(deductions)
  if (notes !== undefined) s.notes = String(notes).trim()
  if (moveOutDate !== undefined) {
    if (!isValidDate(moveOutDate)) throw new ApiError(400, 'Move-out date must be YYYY-MM-DD.')
    s.moveOutDate = moveOutDate
  }
  await refreshSettlement(s)
  if (['shared', 'disputed'].includes(s.status)) {
    s.status = 'draft'
    s.approvedBy = undefined
    s.approvedAt = null
  }
  await s.save()
  await audit('settlement.edited', { target: target(s), details: { refund: s.refundAmount, deductions: s.deductions.length } })
  return json(s)
}, { permission: 'deposits.manage' })

/**
 * submit  — staff send a draft to the owner for approval
 * approve — owner approves (L2) and shares it with the tenant
 * return  — owner sends it back to the preparer as a draft
 * refund  — owner records the refund and closes it: dues are settled from the deposit, tenant moved out
 * cancel  — drop a settlement that hasn't been shared
 */
export const POST = route(async ({ request, params, scope, actor, audit }) => {
  const s = await findSettlement(scope, params.id)
  const body = await readJson(request)
  const approver = can(actor, 'deposits.approve')
  const note = String(body.note ?? '').trim()

  switch (body.action) {
    case 'submit': {
      if (s.status !== 'draft') throw new ApiError(409, 'Only drafts can be sent for approval.')
      await refreshSettlement(s)
      s.status = 'pending_approval'
      await s.save()
      await audit('settlement.submitted', { target: target(s), details: { refund: s.refundAmount } })
      await notifyOrg({
        orgId: s.orgId, capability: 'deposits.approve', type: 'settlement.submitted', link: '/dashboard/approvals',
        title: `Deposit settlement for ${s.tenantName} needs your approval`,
        body: `Deposit ${formatCurrency(s.deposit)} → ${s.refundAmount >= 0 ? `refund ${formatCurrency(s.refundAmount)}` : `tenant owes ${formatCurrency(-s.refundAmount)}`}. Prepared by ${actor.name}.`,
      })
      return json(s)
    }
    case 'approve': {
      if (!approver) throw new ApiError(403, 'Only the owner can approve a deposit settlement.')
      if (!['draft', 'pending_approval'].includes(s.status)) throw new ApiError(409, 'This settlement is not waiting for approval.')
      await refreshSettlement(s)
      s.status = 'shared'
      s.approvedBy = recordedBy(actor)
      s.approvedAt = new Date()
      s.sharedAt = new Date()
      s.tenantResponse = undefined
      await s.save()
      await audit('settlement.approved', { target: target(s), reason: note, details: { deposit: s.deposit, refund: s.refundAmount } })
      await notifyResident({
        residentId: s.residentId, orgId: s.orgId, type: 'settlement.shared', link: '/t/me',
        title: 'Your deposit settlement is ready',
        body: s.refundAmount >= 0 ? `Refund of ${formatCurrency(s.refundAmount)} from your ${formatCurrency(s.deposit)} deposit. Please review and accept it in the app.` : `After deductions you owe ${formatCurrency(-s.refundAmount)}. Please review it in the app.`,
      })
      return json(s)
    }
    case 'return': {
      if (!approver) throw new ApiError(403, 'Only the owner can send a settlement back.')
      if (s.status !== 'pending_approval') throw new ApiError(409, 'This settlement is not waiting for approval.')
      if (note.length < 3) throw new ApiError(400, 'Say what needs changing.')
      s.status = 'draft'
      s.notes = s.notes ? `${s.notes}\nOwner: ${note}` : `Owner: ${note}`
      await s.save()
      await audit('settlement.returned', { target: target(s), reason: note })
      return json(s)
    }
    case 'refund': {
      if (!approver) throw new ApiError(403, 'Only the owner can record the refund.')
      if (!['shared', 'accepted', 'disputed'].includes(s.status)) throw new ApiError(409, 'Approve and share the settlement first.')
      const date = body.date ?? todayISO(APP_TIME_ZONE)
      if (!isValidDate(date)) throw new ApiError(400, 'Refund date must be YYYY-MM-DD.')
      if (!['upi', 'bank', 'cash', 'other'].includes(body.method ?? 'upi')) throw new ApiError(400, 'Unknown refund method.')
      await closeSettlement(s, { method: body.method ?? 'upi', reference: body.reference, date, amount: body.amount, actor: recordedBy(actor) })
      await audit('settlement.closed', { target: target(s), details: { refund: s.refund.amount, method: s.refund.method } })
      await notifyResident({
        residentId: s.residentId, orgId: s.orgId, type: 'settlement.closed', tone: 'success', link: '/t/me',
        title: s.refund.amount > 0 ? `Deposit refund of ${formatCurrency(s.refund.amount)} sent` : 'Your deposit settlement is complete',
        body: s.refund.reference ? `Reference: ${s.refund.reference}` : 'Thank you for staying with us.',
      })
      return json(s)
    }
    case 'cancel': {
      if (!['draft', 'pending_approval'].includes(s.status)) throw new ApiError(409, 'A shared settlement cannot be cancelled — edit it instead.')
      s.status = 'cancelled'
      await s.save()
      await audit('settlement.cancelled', { target: target(s) })
      return json(s)
    }
    default:
      throw new ApiError(400, 'Unknown action.')
  }
}, { permission: 'deposits.manage' })
