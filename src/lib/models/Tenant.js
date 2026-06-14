import mongoose from 'mongoose'

const emergencySchema = new mongoose.Schema({
  name:     { type: String, default: '' },
  phone:    { type: String, default: '' },
  relation: { type: String, default: '' },
}, { _id: false })

const tenantSchema = new mongoose.Schema({
  userId:           { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User', index: true },
  name:             { type: String, required: true, trim: true },
  phone:            { type: String, required: true, trim: true },
  email:            { type: String, default: '', trim: true },
  room:             { type: String, required: true, trim: true },
  rentAmount:       { type: Number, required: true },
  moveInDate:       { type: String, default: '' },
  moveOutDate:      { type: String, default: null },
  status:           { type: String, enum: ['active', 'vacated'], default: 'active' },
  idType:           { type: String, default: '' },
  idNumber:         { type: String, default: '' },
  emergencyContact: { type: emergencySchema, default: () => ({}) },
}, { timestamps: true })

const transform = (_, ret) => {
  ret.id = ret._id.toString()
  delete ret._id
  delete ret.__v
  delete ret.userId
  return ret
}

tenantSchema.set('toJSON', { transform })

export default mongoose.models.Tenant ?? mongoose.model('Tenant', tenantSchema)
