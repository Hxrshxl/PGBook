import mongoose from 'mongoose'

const partySchema = new mongoose.Schema({
  name:      { type: String, default: '' },
  gstin:     { type: String, default: '' },
  address:   { type: String, default: '' },
  stateCode: { type: String, default: '' },
  email:     { type: String, default: '' },
}, { _id: false })

// PGBook's invoice to an owner for their subscription. Never deleted: tax law
// requires invoices to be kept even after an account is closed.
const invoiceSchema = new mongoose.Schema({
  orgId:             { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User', index: true },
  number:            { type: String, required: true, unique: true }, // e.g. PGB/2026-27/00042
  fy:                { type: String, required: true },
  issuedAt:          { type: Date, required: true },
  plan:              { type: String, required: true },
  interval:          { type: String, enum: ['monthly', 'yearly'], required: true },
  description:       { type: String, default: '' },
  periodStart:       { type: Date, default: null },
  periodEnd:         { type: Date, default: null },
  total:             { type: Number, required: true, min: 0 },
  taxable:           { type: Number, required: true, min: 0 },
  cgst:              { type: Number, default: 0 },
  sgst:              { type: Number, default: 0 },
  igst:              { type: Number, default: 0 },
  gstRate:           { type: Number, default: 0 },
  sacCode:           { type: String, default: '998314' }, // IT design & development / SaaS
  seller:            { type: partySchema, required: true },
  buyer:             { type: partySchema, required: true },
  provider:          { type: String, default: '' },
  providerPaymentId: { type: String, default: undefined },
  status:            { type: String, enum: ['paid', 'refunded'], default: 'paid' },
}, { timestamps: true })

invoiceSchema.index({ providerPaymentId: 1 }, { unique: true, sparse: true })
invoiceSchema.index({ issuedAt: -1 })

invoiceSchema.set('toJSON', {
  transform: (_, ret) => {
    ret.id = ret._id.toString()
    ret.orgId = ret.orgId?.toString()
    delete ret._id
    delete ret.__v
    return ret
  },
})

export default mongoose.models.Invoice ?? mongoose.model('Invoice', invoiceSchema)
