import mongoose from 'mongoose'
import { calcPaymentStatus, isValidDate, isValidMonth, roundMoney } from '../../utils/helpers.js'

export const PAYMENT_METHODS = ['upi', 'cash', 'bank', 'card', 'other']

// One row per amount actually received. amountPaid is always the sum of these.
const transactionSchema = new mongoose.Schema({
  amount: { type: Number, required: true, min: [0.01, 'Amount must be greater than zero.'] },
  date:   { type: String, required: true, validate: { validator: isValidDate, message: 'Payment date must be YYYY-MM-DD.' } },
  method: { type: String, enum: { values: PAYMENT_METHODS, message: 'Unknown payment method.' }, default: 'upi' },
  note:   { type: String, default: '', trim: true, maxlength: [200, 'Note is too long.'] },
}, { timestamps: { createdAt: true, updatedAt: false } })

// One Payment = the dues of one tenant for one month (rent + utility share).
const paymentSchema = new mongoose.Schema({
  userId:       { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User', index: true },
  tenantId:     { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Tenant' },
  month:        { type: String, required: true, validate: { validator: isValidMonth, message: 'Month must be YYYY-MM.' } },
  rentAmount:   { type: Number, default: 0, min: [0, 'Rent cannot be negative.'] },
  utilityShare: { type: Number, default: 0, min: [0, 'Utility share cannot be negative.'] },
  amountPaid:   { type: Number, default: 0, min: 0 },
  status:       { type: String, enum: ['paid', 'partial', 'pending'], default: 'pending' },
  paidDate:     { type: String, default: null },
  notes:        { type: String, default: '', trim: true, maxlength: [500, 'Notes are too long.'] },
  transactions: { type: [transactionSchema], default: [] },
}, { timestamps: true })

// A tenant can only have one dues record per month.
paymentSchema.index({ userId: 1, tenantId: 1, month: 1 }, { unique: true })
paymentSchema.index({ userId: 1, month: 1 })

// amountPaid, paidDate and status are always derived — never trusted from clients.
paymentSchema.pre('validate', function () {
  if (this.transactions.length > 0 || this.isModified('transactions')) {
    this.amountPaid = roundMoney(this.transactions.reduce((sum, t) => sum + t.amount, 0))
    this.paidDate = this.transactions.reduce((latest, t) => (!latest || t.date > latest ? t.date : latest), null)
  }
  this.status = calcPaymentStatus(this.amountPaid, (this.rentAmount ?? 0) + (this.utilityShare ?? 0))
})

paymentSchema.set('toJSON', {
  transform: (_, ret) => {
    ret.id = ret._id.toString()
    ret.tenantId = ret.tenantId?.toString()
    ret.transactions = (ret.transactions ?? []).map(t => ({
      id: t._id.toString(), amount: t.amount, date: t.date, method: t.method, note: t.note, createdAt: t.createdAt,
    }))
    delete ret._id
    delete ret.__v
    delete ret.userId
    return ret
  },
})

export default mongoose.models.Payment ?? mongoose.model('Payment', paymentSchema)
