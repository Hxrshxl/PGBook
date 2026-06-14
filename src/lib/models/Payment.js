import mongoose from 'mongoose'

const paymentSchema = new mongoose.Schema({
  userId:       { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User', index: true },
  tenantId:     { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Tenant' },
  month:        { type: String, required: true },
  rentAmount:   { type: Number, default: 0 },
  utilityShare: { type: Number, default: 0 },
  amountPaid:   { type: Number, default: 0 },
  status:       { type: String, enum: ['paid', 'partial', 'pending'], default: 'pending' },
  paidDate:     { type: String, default: null },
  notes:        { type: String, default: '' },
}, { timestamps: true })

paymentSchema.index({ userId: 1, month: 1 })
paymentSchema.index({ userId: 1, tenantId: 1 })

paymentSchema.set('toJSON', {
  transform: (_, ret) => {
    ret.id       = ret._id.toString()
    ret.tenantId = ret.tenantId?.toString()
    delete ret._id
    delete ret.__v
    delete ret.userId
    return ret
  },
})

export default mongoose.models.Payment ?? mongoose.model('Payment', paymentSchema)
