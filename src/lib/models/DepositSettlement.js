import mongoose from 'mongoose'
import { isValidDate } from '../../utils/helpers.js'

const actorSchema = new mongoose.Schema({
  id:   { type: mongoose.Schema.Types.ObjectId },
  name: { type: String, default: '' },
  role: { type: String, default: '' },
}, { _id: false })

const lineSchema = new mongoose.Schema({
  label:  { type: String, required: true, trim: true, maxlength: [80, 'Description is too long.'] },
  amount: { type: Number, required: true, min: [0, 'Amount cannot be negative.'], max: [10000000, 'Amount is too large.'] },
}, { _id: false })

// Move-out accounting: deposit − unpaid dues − deductions = refund (or what the tenant still owes).
//   draft ─▶ pending_approval (staff drafted) ─▶ shared (owner approved; tenant can see it)
//         ─▶ accepted | disputed ─▶ closed (refund recorded, dues settled from the deposit)
const depositSettlementSchema = new mongoose.Schema({
  orgId:        { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User', index: true },
  propertyId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Property', default: null },
  tenantId:     { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Tenant', index: true },
  residentId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Resident', default: null },
  tenantName:   { type: String, default: '' },
  room:         { type: String, default: '' },
  moveOutDate:  { type: String, required: true, validate: { validator: isValidDate, message: 'Date must be YYYY-MM-DD.' } },
  deposit:      { type: Number, required: true, min: 0 },
  unpaidDues:   {
    type: [new mongoose.Schema({ paymentId: mongoose.Schema.Types.ObjectId, month: String, amount: Number }, { _id: false })],
    default: [],
  },
  deductions:   { type: [lineSchema], default: [], validate: { validator: v => v.length <= 20, message: 'At most 20 deductions.' } },
  refundAmount: { type: Number, required: true }, // negative = the tenant still owes this much
  notes:        { type: String, default: '', trim: true, maxlength: [1000, 'Notes are too long.'] },
  status:       { type: String, enum: ['draft', 'pending_approval', 'shared', 'accepted', 'disputed', 'closed', 'cancelled'], default: 'draft' },
  preparedBy:   { type: actorSchema, default: undefined },
  approvedBy:   { type: actorSchema, default: undefined },
  approvedAt:   { type: Date, default: null },
  sharedAt:     { type: Date, default: null },
  tenantResponse: {
    type: new mongoose.Schema({ status: String, comment: String, at: Date }, { _id: false }),
    default: undefined,
  },
  refund:       {
    type: new mongoose.Schema({
      amount: Number, method: String, reference: String, date: String, recordedBy: actorSchema,
    }, { _id: false }),
    default: undefined,
  },
  closedAt:     { type: Date, default: null },
}, { timestamps: true })

depositSettlementSchema.index({ orgId: 1, status: 1 })

depositSettlementSchema.set('toJSON', {
  transform: (_, ret) => {
    ret.id = ret._id.toString()
    for (const k of ['propertyId', 'tenantId', 'residentId']) ret[k] = ret[k]?.toString() ?? null
    ret.unpaidDues = (ret.unpaidDues ?? []).map(d => ({ ...d, paymentId: d.paymentId?.toString() }))
    for (const k of ['preparedBy', 'approvedBy']) if (ret[k]?.id) ret[k].id = ret[k].id.toString()
    if (ret.refund?.recordedBy?.id) ret.refund.recordedBy.id = ret.refund.recordedBy.id.toString()
    delete ret._id
    delete ret.__v
    delete ret.orgId
    return ret
  },
})

export default mongoose.models.DepositSettlement ?? mongoose.model('DepositSettlement', depositSettlementSchema)
