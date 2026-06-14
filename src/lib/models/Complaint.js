import mongoose from 'mongoose'

const complaintSchema = new mongoose.Schema({
  userId:     { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User', index: true },
  tenantId:   { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Tenant' },
  tenantName: { type: String, default: '' },
  room:       { type: String, default: '' },
  category:   { type: String, default: 'other' },
  description:{ type: String, required: true },
  status:     { type: String, enum: ['open', 'in-progress', 'resolved'], default: 'open' },
  priority:   { type: String, enum: ['high', 'medium', 'low'], default: 'medium' },
  ownerNotes: { type: String, default: '' },
  resolvedAt: { type: String, default: null },
}, { timestamps: true })

complaintSchema.set('toJSON', {
  transform: (_, ret) => {
    ret.id        = ret._id.toString()
    ret.tenantId  = ret.tenantId?.toString()
    ret.updatedAt = ret.updatedAt?.toISOString()
    delete ret._id
    delete ret.__v
    delete ret.userId
    return ret
  },
})

export default mongoose.models.Complaint ?? mongoose.model('Complaint', complaintSchema)
