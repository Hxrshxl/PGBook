import mongoose from 'mongoose'

export const GSTIN_RE = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/

const lateFeeSchema = new mongoose.Schema({
  enabled:   { type: Boolean, default: false },
  graceDays: { type: Number, default: 3, min: [0, 'Grace days cannot be negative.'], max: [27, 'Grace days must be 27 or fewer.'] },
  type:      { type: String, enum: { values: ['flat', 'perDay'], message: 'Late fee type must be flat or per day.' }, default: 'flat' },
  amount:    { type: Number, default: 0, min: [0, 'Late fee cannot be negative.'], max: [100000, 'Late fee is too large.'] },
  maxAmount: { type: Number, default: 0, min: [0, 'Maximum late fee cannot be negative.'] }, // 0 = no cap
}, { _id: false })

// A PG building. An owner (organization) can have several.
const propertySchema = new mongoose.Schema({
  orgId:            { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User', index: true },
  name:             { type: String, required: [true, 'Property name is required.'], trim: true, maxlength: [100, 'Name is too long.'] },
  address:          { type: String, default: '', trim: true, maxlength: [300, 'Address is too long.'] },
  city:             { type: String, default: '', trim: true, maxlength: [60, 'City is too long.'] },
  phone:            { type: String, default: '', trim: true, maxlength: [20, 'Phone number is too long.'] },
  ownerName:        { type: String, default: '', trim: true, maxlength: [100, 'Name is too long.'] }, // signs receipts
  upiId:            { type: String, default: '', trim: true, maxlength: [100, 'UPI ID is too long.'] },  // where tenants pay
  logoText:         { type: String, default: '', trim: true, maxlength: [100, 'Receipt heading is too long.'] },
  gstin:            {
    type: String, default: '', trim: true, uppercase: true,
    validate: { validator: v => !v || GSTIN_RE.test(v), message: 'GSTIN must be 15 characters, e.g. 29ABCDE1234F1Z5.' },
  },
  totalBeds:        { type: Number, default: 0, min: 0, max: 10000 }, // used only until rooms are set up
  rentDueDay:       { type: Number, default: 5, min: [1, 'Due day must be between 1 and 28.'], max: [28, 'Due day must be between 1 and 28.'] },
  noticePeriodDays: { type: Number, default: 30, min: [0, 'Notice period cannot be negative.'], max: [180, 'Notice period must be 180 days or fewer.'] },
  lateFee:          { type: lateFeeSchema, default: () => ({}) },
  status:           { type: String, enum: ['active', 'archived'], default: 'active' },
}, { timestamps: true })

propertySchema.set('toJSON', {
  transform: (_, ret) => {
    ret.id = ret._id.toString()
    ret.orgId = ret.orgId?.toString()
    delete ret._id
    delete ret.__v
    return ret
  },
})

export default mongoose.models.Property ?? mongoose.model('Property', propertySchema)
