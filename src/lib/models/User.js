import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'
import { PLAN_IDS, TRIAL_DAYS } from '../plans.js'
import { GSTIN_RE } from '../../utils/gst.js'

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

// Who PGBook's invoices are addressed to (GSTIN lets a business claim input tax credit).
const billingDetailsSchema = new mongoose.Schema({
  legalName: { type: String, default: '', trim: true, maxlength: [120, 'Business name is too long.'] },
  gstin:     { type: String, default: '', trim: true, uppercase: true, validate: { validator: v => !v || GSTIN_RE.test(v), message: 'GSTIN must be 15 characters, e.g. 29ABCDE1234F1Z5.' } },
  address:   { type: String, default: '', trim: true, maxlength: [300, 'Address is too long.'] },
  stateCode: { type: String, default: '', validate: { validator: v => !v || /^\d{2}$/.test(v), message: 'Choose a state.' } },
  email:     { type: String, default: '', trim: true, lowercase: true, validate: { validator: v => !v || EMAIL_RE.test(v), message: 'Please enter a valid email address.' } },
}, { _id: false })

// The PGBook subscription. Absent status on a paid plan = granted by PGBook (no provider).
const billingSchema = new mongoose.Schema({
  status:             { type: String, enum: ['active', 'past_due', 'halted', 'cancelled'] },
  interval:           { type: String, enum: ['monthly', 'yearly'] },
  provider:           { type: String, enum: ['razorpay', 'mock', 'manual'] },
  subscriptionId:     { type: String },
  currentPeriodStart: { type: Date },
  currentPeriodEnd:   { type: Date },
  cancelAtPeriodEnd:  { type: Boolean, default: false },
  cancelledAt:        { type: Date },
  pastDueSince:       { type: Date },
  lastFailureAt:      { type: Date },
  haltedAt:           { type: Date },
  // A checkout that has been started but not paid yet
  pending:            {
    type: new mongoose.Schema({
      subscriptionId: String, plan: String, interval: String, provider: String, createdAt: Date,
    }, { _id: false }),
    default: null,
  },
  details:            { type: billingDetailsSchema, default: () => ({}) },
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
  billing:      { type: billingSchema, default: () => ({}) },

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
userSchema.index({ 'billing.subscriptionId': 1 }, { sparse: true })
userSchema.index({ 'billing.pending.subscriptionId': 1 }, { sparse: true })

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
    delete ret.billing // served separately, as access.billing
    return ret
  },
})

export default mongoose.models.User ?? mongoose.model('User', userSchema)
