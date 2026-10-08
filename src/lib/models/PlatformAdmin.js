import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'

export const ADMIN_PASSWORD_MIN_LENGTH = 12
export const ADMIN_STATUSES = ['invited', 'active', 'disabled']
const ROLES = ['super_admin', 'billing_admin', 'support_agent', 'compliance_officer', 'analyst']

// PGBook staff. Deliberately a separate collection from owners: an admin login
// can never be used as an owner login, and vice versa.
const platformAdminSchema = new mongoose.Schema({
  name:              { type: String, required: [true, 'Name is required.'], trim: true, maxlength: 100 },
  email:             { type: String, required: true, unique: true, lowercase: true, trim: true, match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please enter a valid email address.'] },
  password:          { type: String, select: false },
  role:              { type: String, enum: { values: ROLES, message: 'Unknown admin role.' }, required: true },
  status:            { type: String, enum: ADMIN_STATUSES, default: 'active' },
  tokenVersion:      { type: Number, default: 0 },

  // Two-factor (TOTP). Secrets are encrypted at rest and never leave the server.
  totpSecret:        { type: String, select: false, default: null },
  totpPendingSecret: { type: String, select: false, default: null },
  totpEnabledAt:     { type: Date, default: null },
  lastTotpStep:      { type: Number, select: false, default: -1 }, // blocks code replay

  lastLoginAt:       { type: Date, default: null },
  lastLoginIp:       { type: String, default: '' },
  lastActivityAt:    { type: Date, default: null },
  stepUpAt:          { type: Date, default: null },
  failedLogins:      { type: Number, default: 0 },
  lockedUntil:       { type: Date, default: null },

  inviteTokenHash:   { type: String, select: false, default: null },
  inviteExpiresAt:   { type: Date, default: null },
  invitedBy:         { type: mongoose.Schema.Types.Mixed, default: null },
}, { timestamps: true })

platformAdminSchema.pre('save', async function () {
  if (!this.isModified('password') || !this.password) return
  this.password = await bcrypt.hash(this.password, 12)
})

platformAdminSchema.methods.comparePassword = function (plain) {
  if (!this.password || typeof plain !== 'string') return Promise.resolve(false)
  return bcrypt.compare(plain, this.password)
}

platformAdminSchema.set('toJSON', {
  transform: (_, ret) => {
    ret.id = ret._id.toString()
    ret.twoFactorEnabled = !!ret.totpEnabledAt
    for (const key of ['_id', '__v', 'password', 'totpSecret', 'totpPendingSecret', 'lastTotpStep', 'tokenVersion', 'inviteTokenHash', 'stepUpAt']) delete ret[key]
    return ret
  },
})

export default mongoose.models.PlatformAdmin ?? mongoose.model('PlatformAdmin', platformAdminSchema)
