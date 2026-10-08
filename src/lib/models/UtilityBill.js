import mongoose from 'mongoose'
import { isValidMonth } from '../../utils/helpers.js'

export const BILL_TYPES = ['electricity', 'water', 'maintenance', 'internet', 'gas', 'other']

// Exactly who was charged how much — used to recompute dues when a bill is deleted.
const allocationSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Tenant' },
  amount:   { type: Number, required: true, min: 0 },
}, { _id: false })

const utilityBillSchema = new mongoose.Schema({
  userId:          { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User', index: true },
  month:           { type: String, required: true, validate: { validator: isValidMonth, message: 'Month must be YYYY-MM.' } },
  type:            { type: String, enum: { values: BILL_TYPES, message: 'Unknown bill type.' }, default: 'electricity' },
  totalAmount:     { type: Number, required: [true, 'Bill amount is required.'], min: [0.01, 'Bill amount must be greater than zero.'], max: [10000000, 'Bill amount is too large.'] },
  perTenantAmount: { type: Number, required: true },
  tenantCount:     { type: Number, required: true, min: 1 },
  splitMethod:     { type: String, enum: ['equal'], default: 'equal' },
  note:            { type: String, default: '', trim: true, maxlength: [200, 'Note is too long.'] },
  allocations:     { type: [allocationSchema], default: [] },
}, { timestamps: true })

utilityBillSchema.index({ userId: 1, month: 1 })

utilityBillSchema.set('toJSON', {
  transform: (_, ret) => {
    ret.id = ret._id.toString()
    ret.allocations = (ret.allocations ?? []).map(a => ({ tenantId: a.tenantId.toString(), amount: a.amount }))
    delete ret._id
    delete ret.__v
    delete ret.userId
    return ret
  },
})

export default mongoose.models.UtilityBill ?? mongoose.model('UtilityBill', utilityBillSchema)
