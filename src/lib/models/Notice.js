import mongoose from 'mongoose'

const actorSchema = new mongoose.Schema({
  id:   { type: mongoose.Schema.Types.ObjectId },
  name: { type: String, default: '' },
  role: { type: String, default: '' },
}, { _id: false })

// An announcement to residents (water cut, rule change, food menu…).
const noticeSchema = new mongoose.Schema({
  orgId:       { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User', index: true },
  propertyIds: { type: [mongoose.Schema.Types.ObjectId], default: [] }, // empty = every property
  title:       { type: String, required: [true, 'Title is required.'], trim: true, maxlength: [120, 'Title is too long.'] },
  body:        { type: String, default: '', trim: true, maxlength: [3000, 'Notice is too long.'] },
  pinned:      { type: Boolean, default: false },
  requiresAck: { type: Boolean, default: false },
  acks:        {
    type: [new mongoose.Schema({ tenantId: mongoose.Schema.Types.ObjectId, name: String, at: Date }, { _id: false })],
    default: [],
  },
  createdBy:   { type: actorSchema, default: undefined },
  expiresAt:   { type: Date, default: null },
  status:      { type: String, enum: ['active', 'archived'], default: 'active' },
}, { timestamps: true })

noticeSchema.index({ orgId: 1, status: 1, createdAt: -1 })

noticeSchema.set('toJSON', {
  transform: (_, ret) => {
    ret.id = ret._id.toString()
    ret.propertyIds = (ret.propertyIds ?? []).map(String)
    ret.acks = (ret.acks ?? []).map(a => ({ tenantId: a.tenantId?.toString(), name: a.name, at: a.at }))
    if (ret.createdBy?.id) ret.createdBy.id = ret.createdBy.id.toString()
    delete ret._id
    delete ret.__v
    delete ret.orgId
    return ret
  },
})

export default mongoose.models.Notice ?? mongoose.model('Notice', noticeSchema)
