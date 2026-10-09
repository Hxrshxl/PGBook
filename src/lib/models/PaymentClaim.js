import mongoose from 'mongoose'
import { isValidDate } from '../../utils/helpers.js'

const actorSchema = new mongoose.Schema({
  id:   { type: mongoose.Schema.Types.ObjectId },
  name: { type: String, default: '' },
  role: { type: String, default: '' },
}, { _id: false })

// A tenant saying "I've paid". It only reaches the ledger once the owner (or a
// manager/accountant) approves it. Never edits money by itself.
const paymentClaimSchema = new mongoose.Schema({
  orgId:         { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User', index: true },
  propertyId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Property', default: null },
  tenantId:      { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Tenant', index: true },
  residentId:    { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Resident' },
  paymentId:     { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Payment' },
  tenantName:    { type: String, default: '' },
  room:          { type: String, default: '' },
  month:         { type: String, required: true },
  amount:        { type: Number, required: true, min: [1, 'Amount must be at least ₹1.'], max: [10000000, 'Amount is too large.'] },
  date:          { type: String, required: true, validate: { validator: isValidDate, message: 'Date must be YYYY-MM-DD.' } },
  method:        { type: String, enum: { values: ['upi', 'bank', 'cash', 'card', 'other'], message: 'Unknown payment method.' }, default: 'upi' },
  utr:           { type: String, default: '', trim: true, uppercase: true, maxlength: [40, 'Reference is too long.'] },
  note:          { type: String, default: '', trim: true, maxlength: [300, 'Note is too long.'] },
  screenshotId:  { type: mongoose.Schema.Types.ObjectId, default: null },
  flags:         { type: [String], default: [] }, // duplicate_utr, over_balance
  status:        { type: String, enum: ['pending', 'approved', 'rejected', 'withdrawn'], default: 'pending' },
  decidedBy:     { type: actorSchema, default: undefined },
  decidedAt:     { type: Date, default: null },
  decisionNote:  { type: String, default: '', trim: true, maxlength: 300 },
  transactionId: { type: mongoose.Schema.Types.ObjectId, default: null },
}, { timestamps: true })

paymentClaimSchema.index({ orgId: 1, status: 1, createdAt: -1 })
paymentClaimSchema.index({ orgId: 1, utr: 1 })

paymentClaimSchema.set('toJSON', {
  transform: (_, ret) => {
    ret.id = ret._id.toString()
    for (const k of ['propertyId', 'tenantId', 'residentId', 'paymentId', 'screenshotId', 'transactionId']) ret[k] = ret[k]?.toString() ?? null
    if (ret.decidedBy?.id) ret.decidedBy.id = ret.decidedBy.id.toString()
    delete ret._id
    delete ret.__v
    delete ret.orgId
    return ret
  },
})

export default mongoose.models.PaymentClaim ?? mongoose.model('PaymentClaim', paymentClaimSchema)
