import mongoose from 'mongoose'

export const STAFF_ROLES = ['manager', 'accountant', 'caretaker']

// A staff member's access to an owner's organization.
const membershipSchema = new mongoose.Schema({
  orgId:           { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User', index: true },
  userId:          { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true }, // set when the invite is accepted
  name:            { type: String, required: [true, 'Name is required.'], trim: true, maxlength: 100 },
  email:           { type: String, required: [true, 'Email is required.'], lowercase: true, trim: true, match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please enter a valid email address.'] },
  role:            { type: String, enum: { values: STAFF_ROLES, message: 'Role must be manager, accountant or caretaker.' }, required: true },
  propertyIds:     { type: [mongoose.Schema.Types.ObjectId], default: [] }, // empty = all properties
  status:          { type: String, enum: ['invited', 'active', 'removed'], default: 'invited' },
  inviteTokenHash: { type: String, select: false, default: null },
  inviteExpiresAt: { type: Date, default: null },
  invitedBy:       { type: String, default: '' },
  joinedAt:        { type: Date, default: null },
  removedAt:       { type: Date, default: null },
}, { timestamps: true })

membershipSchema.index({ orgId: 1, email: 1 })

membershipSchema.set('toJSON', {
  transform: (_, ret) => {
    ret.id = ret._id.toString()
    ret.orgId = ret.orgId?.toString()
    ret.userId = ret.userId?.toString() ?? null
    ret.propertyIds = (ret.propertyIds ?? []).map(String)
    delete ret._id
    delete ret.__v
    delete ret.inviteTokenHash
    return ret
  },
})

export default mongoose.models.Membership ?? mongoose.model('Membership', membershipSchema)
