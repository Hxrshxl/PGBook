import mongoose from 'mongoose'
import { isValidDate } from '../../utils/helpers.js'

const actorSchema = new mongoose.Schema({
  id:   { type: mongoose.Schema.Types.ObjectId },
  name: { type: String, default: '' },
  role: { type: String, default: '' },
}, { _id: false })

// Cash a caretaker received from a tenant. It only becomes a payment on the
// tenant's dues once the owner (or an accountant/manager) confirms the handover.
const cashCollectionSchema = new mongoose.Schema({
  orgId:        { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User', index: true },
  propertyId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Property' },
  paymentId:    { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Payment' },
  tenantId:     { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Tenant' },
  tenantName:   { type: String, default: '' },
  room:         { type: String, default: '' },
  month:        { type: String, default: '' },
  amount:       { type: Number, required: true, min: [0.01, 'Amount must be greater than zero.'] },
  date:         { type: String, required: true, validate: { validator: isValidDate, message: 'Date must be YYYY-MM-DD.' } },
  note:         { type: String, default: '', trim: true, maxlength: [200, 'Note is too long.'] },
  collectedBy:  { type: actorSchema, required: true },
  status:       { type: String, enum: ['pending', 'confirmed', 'rejected'], default: 'pending' },
  decidedBy:    { type: actorSchema, default: undefined },
  decidedAt:    { type: Date, default: null },
  decisionNote: { type: String, default: '', trim: true, maxlength: 300 },
}, { timestamps: true })

cashCollectionSchema.index({ orgId: 1, status: 1, createdAt: -1 })

cashCollectionSchema.set('toJSON', {
  transform: (_, ret) => {
    ret.id = ret._id.toString()
    for (const key of ['propertyId', 'paymentId', 'tenantId']) ret[key] = ret[key]?.toString()
    if (ret.collectedBy?.id) ret.collectedBy.id = ret.collectedBy.id.toString()
    if (ret.decidedBy?.id) ret.decidedBy.id = ret.decidedBy.id.toString()
    delete ret._id
    delete ret.__v
    delete ret.orgId
    return ret
  },
})

export default mongoose.models.CashCollection ?? mongoose.model('CashCollection', cashCollectionSchema)
