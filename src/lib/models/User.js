import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'

const pgSettingsSchema = new mongoose.Schema({
  pgName:    { type: String, default: '' },
  address:   { type: String, default: '' },
  ownerName: { type: String, default: '' },
  phone:     { type: String, default: '' },
  upiId:     { type: String, default: '' },
  logoText:  { type: String, default: 'PGBook' },
}, { _id: false })

const userSchema = new mongoose.Schema({
  name:       { type: String, required: true, trim: true },
  email:      { type: String, required: true, unique: true, lowercase: true, trim: true },
  password:   { type: String, required: true },
  pgName:     { type: String, default: '' },
  plan:       { type: String, default: 'pro' },
  pgSettings: { type: pgSettingsSchema, default: () => ({}) },
}, { timestamps: true })

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next()
  this.password = await bcrypt.hash(this.password, 10)
  next()
})

userSchema.methods.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.password)
}

userSchema.set('toJSON', {
  transform: (_, ret) => {
    ret.id = ret._id.toString()
    delete ret._id
    delete ret.__v
    delete ret.password
    return ret
  },
})

export default mongoose.models.User ?? mongoose.model('User', userSchema)
