import mongoose from 'mongoose'
import { EXPENSE_CATEGORIES, isValidDate } from '../../utils/helpers.js'

export { EXPENSE_CATEGORIES }

const actorSchema = new mongoose.Schema({
  id:   { type: mongoose.Schema.Types.ObjectId },
  name: { type: String, default: '' },
  role: { type: String, default: '' },
}, { _id: false })

// Money the owner spends running a property, for profit & loss.
const expenseSchema = new mongoose.Schema({
  orgId:      { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User', index: true },
  propertyId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Property' },
  date:       { type: String, required: [true, 'Date is required.'], validate: { validator: isValidDate, message: 'Date must be YYYY-MM-DD.' } },
  month:      { type: String, required: true },
  category:   { type: String, enum: { values: EXPENSE_CATEGORIES, message: 'Unknown category.' }, default: 'other' },
  amount:     { type: Number, required: [true, 'Amount is required.'], min: [0.01, 'Amount must be greater than zero.'], max: [100000000, 'Amount is too large.'] },
  paidTo:     { type: String, default: '', trim: true, maxlength: [100, 'Too long.'] },
  method:     { type: String, enum: ['upi', 'cash', 'bank', 'card', 'other'], default: 'upi' },
  note:       { type: String, default: '', trim: true, maxlength: [300, 'Note is too long.'] },
  recordedBy: { type: actorSchema, default: undefined },
}, { timestamps: true })

expenseSchema.index({ orgId: 1, month: 1 })

expenseSchema.pre('validate', function () {
  if (this.date) this.month = this.date.slice(0, 7)
})

expenseSchema.set('toJSON', {
  transform: (_, ret) => {
    ret.id = ret._id.toString()
    ret.propertyId = ret.propertyId?.toString()
    if (ret.recordedBy?.id) ret.recordedBy.id = ret.recordedBy.id.toString()
    delete ret._id
    delete ret.__v
    delete ret.orgId
    return ret
  },
})

export default mongoose.models.Expense ?? mongoose.model('Expense', expenseSchema)
