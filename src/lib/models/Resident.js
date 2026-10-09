import mongoose from 'mongoose'

// A person who signs in to the tenant app with their phone number. Their stays
// (Tenant records, possibly at several PGs over the years) point here via residentId.
const residentSchema = new mongoose.Schema({
  phone:        { type: String, required: true, unique: true }, // digits with country code, e.g. 919876543210
  name:         { type: String, default: '', trim: true, maxlength: 100 },
  status:       { type: String, enum: ['active', 'blocked'], default: 'active' },
  tokenVersion: { type: Number, default: 0 },
  consentAt:    { type: Date, default: null },   // accepted the privacy notice
  language:     { type: String, enum: ['en', 'hi'], default: 'en' },
  lastLoginAt:  { type: Date, default: null },
  lastSeenAt:   { type: Date, default: null },
}, { timestamps: true })

residentSchema.set('toJSON', {
  transform: (_, ret) => {
    ret.id = ret._id.toString()
    delete ret._id
    delete ret.__v
    delete ret.tokenVersion
    return ret
  },
})

export default mongoose.models.Resident ?? mongoose.model('Resident', residentSchema)
