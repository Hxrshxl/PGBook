import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'
import { PLAN_IDS, TRIAL_DAYS } from '../plans.js'

export const PASSWORD_MIN_LENGTH = 8
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const pgSettingsSchema = new mongoose.Schema({
  pgName:     { type: String, default: '', trim: true, maxlength: [100, 'PG name is too long.'] },
  address:    { type: String, default: '', trim: true, maxlength: [300, 'Address is too long.'] },
  ownerName:  { type: String, default: '', trim: true, maxlength: [100, 'Owner name is too long.'] },
  phone:      { type: String, default: '', trim: true, maxlength: [20, 'Phone number is too long.'] },
  upiId:      { type: String, default: '', trim: true, maxlength: [100, 'UPI ID is too long.'] },
  logoText:   { type: String, default: '', trim: true, maxlength: [100, 'Brand name is too long.'] },
  totalBeds:  { type: Number, default: 0, min: [0, 'Total beds cannot be negative.'], max: [10000, 'Total beds is too large.'] },
  rentDueDay: { type: Number, default: 5, min: [1, 'Due day must be between 1 and 28.'], max: [28, 'Due day must be between 1 and 28.'] },
}, { _id: false })

const userSchema = new mongoose.Schema({
  name:         { type: String, required: [true, 'Name is required.'], trim: true, maxlength: [100, 'Name is too long.'] },
  email:        {
    type: String, required: [true, 'Email is required.'], unique: true, lowercase: true, trim: true,
    match: [EMAIL_RE, 'Please enter a valid email address.'],
  },
  password:     { type: String, required: true, select: false },
  plan:         { type: String, enum: PLAN_IDS, default: 'trial' },
  trialEndsAt:  { type: Date, default: () => new Date(Date.now() + TRIAL_DAYS * 86400000) },
  tokenVersion: { type: Number, default: 0 },
  pgSettings:   { type: pgSettingsSchema, default: () => ({}) },

  // 'owner' accounts own an organization; 'staff' accounts belong to one through a Membership.
  kind:         { type: String, enum: ['owner', 'staff'], default: 'owner' },
  orgVersion:   { type: Number, default: 0 },    // data-model migrations applied to this organization
  migratingAt:  { type: Date, default: null },

  // Account lifecycle, managed by PGBook admins
  status:       { type: String, enum: ['active', 'suspended'], default: 'active' },
  suspension:   {
    type: new mongoose.Schema({
      at:     { type: Date },
      reason: { type: String, default: '' },
      by:     { type: String, default: '' }, // admin name + role, for the record
    }, { _id: false }),
    default: null,
  },
  lastLoginAt:  { type: Date, default: null },
  lastActiveAt: { type: Date, default: null },
}, { timestamps: true })

/** Trial end, also for accounts created before trialEndsAt existed. */
userSchema.methods.effectiveTrialEnd = function () {
  return this.trialEndsAt ?? new Date(this.createdAt.getTime() + TRIAL_DAYS * 86400000)
}

userSchema.pre('save', async function () {
  if (!this.isModified('password')) return
  this.password = await bcrypt.hash(this.password, 12)
})

userSchema.methods.comparePassword = function (plain) {
  if (!this.password || typeof plain !== 'string') return Promise.resolve(false)
  return bcrypt.compare(plain, this.password)
}

userSchema.set('toJSON', {
  transform: (_, ret) => {
    ret.id = ret._id.toString()
    delete ret._id
    delete ret.__v
    delete ret.password
    delete ret.tokenVersion
    delete ret.pgName // legacy top-level field; use pgSettings.pgName
    return ret
  },
})

export default mongoose.models.User ?? mongoose.model('User', userSchema)
