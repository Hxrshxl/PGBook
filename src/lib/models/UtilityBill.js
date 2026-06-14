import mongoose from 'mongoose'

const utilityBillSchema = new mongoose.Schema({
  userId:           { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User', index: true },
  month:            { type: String, required: true },
  type:             { type: String, enum: ['electricity', 'water', 'maintenance', 'internet', 'other'], default: 'electricity' },
  totalAmount:      { type: Number, required: true },
  perTenantAmount:  { type: Number, required: true },
  tenantCount:      { type: Number, required: true },
  splitMethod:      { type: String, default: 'equal' },
}, { timestamps: true })

utilityBillSchema.set('toJSON', {
  transform: (_, ret) => {
    ret.id = ret._id.toString()
    delete ret._id
    delete ret.__v
    delete ret.userId
    return ret
  },
})

export default mongoose.models.UtilityBill ?? mongoose.model('UtilityBill', utilityBillSchema)
