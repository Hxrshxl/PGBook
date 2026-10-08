import mongoose from 'mongoose'
import { isValidDate, isValidPhone } from '../../utils/helpers.js'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export const ID_TYPES = ['aadhaar', 'passport', 'dl', 'voter', 'pan', 'other', '']

const optionalDate = {
  validator: v => v === null || v === '' || isValidDate(v),
  message: 'Dates must be in YYYY-MM-DD format.',
}

const emergencySchema = new mongoose.Schema({
  name:     { type: String, default: '', trim: true, maxlength: 100 },
  phone:    { type: String, default: '', trim: true, maxlength: 20 },
  relation: { type: String, default: '', trim: true, maxlength: 50 },
}, { _id: false })

const tenantSchema = new mongoose.Schema({
  userId:           { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User', index: true },
  name:             { type: String, required: [true, 'Tenant name is required.'], trim: true, maxlength: [100, 'Name is too long.'] },
  phone:            {
    type: String, required: [true, 'Phone number is required.'], trim: true,
    validate: { validator: isValidPhone, message: 'Please enter a valid phone number (at least 10 digits).' },
  },
  email:            {
    type: String, default: '', trim: true, lowercase: true,
    validate: { validator: v => !v || EMAIL_RE.test(v), message: 'Please enter a valid email address.' },
  },
  room:             { type: String, required: [true, 'Room is required.'], trim: true, maxlength: [20, 'Room name is too long.'] },
  rentAmount:       { type: Number, required: [true, 'Monthly rent is required.'], min: [0, 'Rent cannot be negative.'], max: [10000000, 'Rent is too large.'] },
  depositAmount:    { type: Number, default: 0, min: [0, 'Deposit cannot be negative.'], max: [10000000, 'Deposit is too large.'] },
  moveInDate:       { type: String, default: '', validate: optionalDate },
  moveOutDate:      { type: String, default: null, validate: optionalDate },
  status:           { type: String, enum: ['active', 'vacated'], default: 'active' },
  idType:           { type: String, enum: { values: ID_TYPES, message: 'Unknown ID type.' }, default: '' },
  idNumber:         { type: String, default: '', trim: true, maxlength: 50 },
  emergencyContact: { type: emergencySchema, default: () => ({}) },
  notes:            { type: String, default: '', trim: true, maxlength: [1000, 'Notes are too long.'] },
}, { timestamps: true })

tenantSchema.index({ userId: 1, status: 1 })

tenantSchema.set('toJSON', {
  transform: (_, ret) => {
    ret.id = ret._id.toString()
    delete ret._id
    delete ret.__v
    delete ret.userId
    return ret
  },
})

export default mongoose.models.Tenant ?? mongoose.model('Tenant', tenantSchema)
