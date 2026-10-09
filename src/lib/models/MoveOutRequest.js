import mongoose from 'mongoose'
import { isValidDate } from '../../utils/helpers.js'

const actorSchema = new mongoose.Schema({
  id:   { type: mongoose.Schema.Types.ObjectId },
  name: { type: String, default: '' },
  role: { type: String, default: '' },
}, { _id: false })

// A tenant giving notice from the app. The owner acknowledges it; the tenant can
// withdraw it until then.
const moveOutRequestSchema = new mongoose.Schema({
  orgId:        { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User', index: true },
  propertyId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Property', default: null },
  tenantId:     { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Tenant', index: true },
  residentId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Resident', default: null },
  tenantName:   { type: String, default: '' },
  room:         { type: String, default: '' },
  moveOutDate:  { type: String, required: true, validate: { validator: isValidDate, message: 'Date must be YYYY-MM-DD.' } },
  earliestDate: { type: String, default: '' }, // notice period end when the notice was given
  reason:       { type: String, default: '', trim: true, maxlength: [500, 'Reason is too long.'] },
  status:       { type: String, enum: ['pending', 'acknowledged', 'declined', 'withdrawn'], default: 'pending' },
  decidedBy:    { type: actorSchema, default: undefined },
  decidedAt:    { type: Date, default: null },
  decisionNote: { type: String, default: '', trim: true, maxlength: 300 },
}, { timestamps: true })

moveOutRequestSchema.index({ orgId: 1, status: 1 })

moveOutRequestSchema.set('toJSON', {
  transform: (_, ret) => {
    ret.id = ret._id.toString()
    for (const k of ['propertyId', 'tenantId', 'residentId']) ret[k] = ret[k]?.toString() ?? null
    if (ret.decidedBy?.id) ret.decidedBy.id = ret.decidedBy.id.toString()
    delete ret._id
    delete ret.__v
    delete ret.orgId
    return ret
  },
})

export default mongoose.models.MoveOutRequest ?? mongoose.model('MoveOutRequest', moveOutRequestSchema)
