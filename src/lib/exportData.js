// "Export all data": every record of an organization as CSV files in one ZIP.
import Property from './models/Property.js'
import Room from './models/Room.js'
import Tenant from './models/Tenant.js'
import Payment from './models/Payment.js'
import UtilityBill from './models/UtilityBill.js'
import Complaint from './models/Complaint.js'
import Expense from './models/Expense.js'
import CashCollection from './models/CashCollection.js'
import Membership from './models/Membership.js'
import AuditEvent from './models/AuditEvent.js'
import Invoice from './models/Invoice.js'
import PaymentClaim from './models/PaymentClaim.js'
import Notice from './models/Notice.js'
import MoveOutRequest from './models/MoveOutRequest.js'
import DepositSettlement from './models/DepositSettlement.js'
import { toCsv } from './csv.js'
import { createZip } from './zip.js'
import { getBalance, getTotalDue } from '../utils/helpers.js'

const id = v => (v ? String(v) : '')
const charges = list => (list ?? []).map(c => `${c.label}: ${c.amount}`).join('; ')
const actor = a => (a?.name ? `${a.name}${a.role ? ` (${a.role})` : ''}` : '')

export async function buildOrgExport(org) {
  const orgId = org._id
  const [properties, rooms, tenants, payments, bills, complaints, expenses, cash, members, events, invoices, claims, notices, moveOuts, settlements] = await Promise.all([
    Property.find({ orgId }).lean(),
    Room.find({ orgId }).lean(),
    Tenant.find({ userId: orgId }).lean(),
    Payment.find({ userId: orgId }).sort({ month: 1 }).lean(),
    UtilityBill.find({ userId: orgId }).sort({ month: 1 }).lean(),
    Complaint.find({ userId: orgId }).sort({ createdAt: 1 }).lean(),
    Expense.find({ orgId }).sort({ date: 1 }).lean(),
    CashCollection.find({ orgId }).sort({ createdAt: 1 }).lean(),
    Membership.find({ orgId }).lean(),
    AuditEvent.find({ orgId }).sort({ createdAt: 1 }).lean(),
    Invoice.find({ orgId }).sort({ issuedAt: 1 }).lean(),
    PaymentClaim.find({ orgId }).sort({ createdAt: 1 }).lean(),
    Notice.find({ orgId }).sort({ createdAt: 1 }).lean(),
    MoveOutRequest.find({ orgId }).sort({ createdAt: 1 }).lean(),
    DepositSettlement.find({ orgId }).sort({ createdAt: 1 }).lean(),
  ])
  const propertyName = new Map(properties.map(p => [id(p._id), p.name]))
  const tenantName = new Map(tenants.map(t => [id(t._id), t.name]))
  const prop = r => propertyName.get(id(r.propertyId)) ?? ''

  const files = [
    ['properties.csv', properties, [
      ['id', r => id(r._id)], ['name', r => r.name], ['address', r => r.address], ['city', r => r.city], ['phone', r => r.phone],
      ['owner_name', r => r.ownerName], ['upi_id', r => r.upiId], ['gstin', r => r.gstin], ['rent_due_day', r => r.rentDueDay],
      ['notice_period_days', r => r.noticePeriodDays], ['late_fee', r => r.lateFee], ['status', r => r.status], ['created_at', r => r.createdAt],
    ]],
    ['rooms.csv', rooms, [
      ['id', r => id(r._id)], ['property', prop], ['name', r => r.name], ['floor', r => r.floor], ['beds', r => r.capacity],
      ['rent_per_bed', r => r.rent], ['notes', r => r.notes], ['status', r => r.status],
    ]],
    ['tenants.csv', tenants, [
      ['id', r => id(r._id)], ['property', prop], ['name', r => r.name], ['phone', r => r.phone], ['email', r => r.email], ['room', r => r.room],
      ['rent', r => r.rentAmount], ['deposit', r => r.depositAmount], ['monthly_charges', r => charges(r.recurringCharges)],
      ['move_in', r => r.moveInDate], ['move_out', r => r.moveOutDate], ['status', r => r.status], ['id_type', r => r.idType],
      ['id_number', r => r.idNumber], ['emergency_contact', r => [r.emergencyContact?.name, r.emergencyContact?.phone, r.emergencyContact?.relation].filter(Boolean).join(' / ')],
      ['notes', r => r.notes], ['notice_given_at', r => r.noticeGivenAt], ['expected_move_out', r => r.expectedMoveOut],
    ]],
    ['dues.csv', payments, [
      ['id', r => id(r._id)], ['property', prop], ['tenant', r => tenantName.get(id(r.tenantId)) ?? ''], ['month', r => r.month],
      ['rent', r => r.rentAmount], ['charges', r => charges(r.extraCharges)], ['utility_share', r => r.utilityShare], ['late_fee', r => r.lateFee],
      ['total_due', r => getTotalDue(r)], ['paid', r => r.amountPaid], ['balance', r => getBalance(r)], ['status', r => r.status], ['notes', r => r.notes],
    ]],
    ['payments_received.csv', payments.flatMap(p => (p.transactions ?? []).map(t => ({ ...t, due: p }))), [
      ['due_id', r => id(r.due._id)], ['tenant', r => tenantName.get(id(r.due.tenantId)) ?? ''], ['month', r => r.due.month],
      ['date', r => r.date], ['amount', r => r.amount], ['method', r => r.method], ['reference', r => r.note], ['source', r => r.source ?? 'direct'],
      ['recorded_by', r => actor(r.recordedBy)],
    ]],
    ['utility_bills.csv', bills, [
      ['id', r => id(r._id)], ['property', prop], ['month', r => r.month], ['type', r => r.type], ['total', r => r.totalAmount],
      ['tenants', r => r.tenantCount], ['per_tenant', r => r.perTenantAmount], ['note', r => r.note],
    ]],
    ['expenses.csv', expenses, [
      ['id', r => id(r._id)], ['property', prop], ['date', r => r.date], ['category', r => r.category], ['amount', r => r.amount],
      ['paid_to', r => r.paidTo], ['method', r => r.method], ['note', r => r.note], ['recorded_by', r => actor(r.recordedBy)],
    ]],
    ['complaints.csv', complaints, [
      ['id', r => id(r._id)], ['property', prop], ['tenant', r => r.tenantName], ['room', r => r.room], ['category', r => r.category],
      ['priority', r => r.priority], ['status', r => r.status], ['description', r => r.description], ['notes', r => r.ownerNotes],
      ['raised_in_app', r => r.source === 'resident'], ['created_at', r => r.createdAt], ['resolved_at', r => r.resolvedAt],
    ]],
    ['cash_handovers.csv', cash, [
      ['id', r => id(r._id)], ['tenant', r => r.tenantName], ['month', r => r.month], ['amount', r => r.amount], ['date', r => r.date],
      ['collected_by', r => actor(r.collectedBy)], ['status', r => r.status], ['decided_by', r => actor(r.decidedBy)], ['note', r => r.decisionNote || r.note],
    ]],
    ['payment_claims.csv', claims, [
      ['id', r => id(r._id)], ['tenant', r => r.tenantName], ['month', r => r.month], ['amount', r => r.amount], ['date', r => r.date],
      ['method', r => r.method], ['utr', r => r.utr], ['status', r => r.status], ['decided_by', r => actor(r.decidedBy)], ['decision_note', r => r.decisionNote],
    ]],
    ['move_out_notices.csv', moveOuts, [
      ['id', r => id(r._id)], ['tenant', r => r.tenantName], ['move_out_date', r => r.moveOutDate], ['reason', r => r.reason],
      ['status', r => r.status], ['given_at', r => r.createdAt], ['decided_by', r => actor(r.decidedBy)],
    ]],
    ['deposit_settlements.csv', settlements, [
      ['id', r => id(r._id)], ['tenant', r => r.tenantName], ['move_out_date', r => r.moveOutDate], ['deposit', r => r.deposit],
      ['unpaid_dues', r => (r.unpaidDues ?? []).reduce((s, d) => s + d.amount, 0)], ['deductions', r => charges(r.deductions)],
      ['refund', r => r.refundAmount], ['status', r => r.status], ['tenant_response', r => r.tenantResponse?.status ?? ''],
      ['refund_reference', r => r.refund?.reference ?? ''],
    ]],
    ['notices.csv', notices, [
      ['id', r => id(r._id)], ['title', r => r.title], ['body', r => r.body], ['properties', r => (r.propertyIds ?? []).map(p => propertyName.get(id(p))).join('; ') || 'All'],
      ['acknowledged_by', r => (r.acks ?? []).length], ['created_at', r => r.createdAt], ['status', r => r.status],
    ]],
    ['team.csv', members, [
      ['name', r => r.name], ['email', r => r.email], ['role', r => r.role], ['status', r => r.status],
      ['properties', r => (r.propertyIds ?? []).map(p => propertyName.get(id(p))).join('; ') || 'All'], ['joined_at', r => r.joinedAt],
    ]],
    ['activity_log.csv', events, [
      ['at', r => r.createdAt], ['who', r => actor(r.actor)], ['action', r => r.action], ['target', r => r.target?.label ?? ''],
      ['reason', r => r.reason], ['details', r => r.details ?? ''],
    ]],
    ['pgbook_invoices.csv', invoices, [
      ['number', r => r.number], ['date', r => r.issuedAt], ['plan', r => r.plan], ['interval', r => r.interval], ['taxable', r => r.taxable],
      ['cgst', r => r.cgst], ['sgst', r => r.sgst], ['igst', r => r.igst], ['total', r => r.total],
    ]],
  ].map(([name, rows, columns]) => ({ name, content: toCsv(rows, columns) }))

  files.unshift({
    name: 'README.txt',
    content: `PGBook export for ${org.name} <${org.email}>\nCreated ${new Date().toISOString()}\n\nEach .csv file opens in Excel or Google Sheets. Amounts are in rupees.\nThis export contains personal data of your tenants — store it securely.\n`,
  })
  return { zip: createZip(files), counts: { tenants: tenants.length, dues: payments.length, files: files.length } }
}
