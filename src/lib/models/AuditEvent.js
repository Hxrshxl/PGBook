import mongoose from 'mongoose'

export const ACTOR_REALMS = ['admin', 'org', 'resident', 'system']

const actorSchema = new mongoose.Schema({
  realm: { type: String, enum: ACTOR_REALMS, required: true },
  id:    { type: mongoose.Schema.Types.ObjectId, default: null },
  name:  { type: String, default: '' },
  role:  { type: String, default: '' },
}, { _id: false })

const targetSchema = new mongoose.Schema({
  kind:  { type: String, default: '' },
  id:    { type: String, default: '' },
  label: { type: String, default: '' },
}, { _id: false })

// Append-only record of who did what. There is no API to edit or delete these,
// and the model refuses update/delete operations outright.
const auditEventSchema = new mongoose.Schema({
  actor:     { type: actorSchema, required: true },
  action:    { type: String, required: true },
  orgId:     { type: mongoose.Schema.Types.ObjectId, default: null }, // owner account the event belongs to
  target:    { type: targetSchema, default: undefined },
  reason:    { type: String, default: '', maxlength: 1000 },
  details:   { type: mongoose.Schema.Types.Mixed, default: undefined },
  ip:        { type: String, default: '' },
  userAgent: { type: String, default: '' },
}, { timestamps: { createdAt: true, updatedAt: false } })

auditEventSchema.index({ orgId: 1, createdAt: -1 })
auditEventSchema.index({ createdAt: -1 })
auditEventSchema.index({ action: 1, createdAt: -1 })
auditEventSchema.index({ 'actor.id': 1, createdAt: -1 })

function immutable() {
  throw new Error('Audit events are immutable.')
}
for (const op of ['updateOne', 'updateMany', 'findOneAndUpdate', 'replaceOne', 'findOneAndReplace', 'deleteOne', 'deleteMany', 'findOneAndDelete']) {
  auditEventSchema.pre(op, immutable)
}
auditEventSchema.pre('save', function () {
  if (!this.isNew) immutable()
})

auditEventSchema.set('toJSON', {
  transform: (_, ret) => {
    ret.id = ret._id.toString()
    ret.orgId = ret.orgId?.toString() ?? null
    if (ret.actor?.id) ret.actor.id = ret.actor.id.toString()
    delete ret._id
    delete ret.__v
    return ret
  },
})

export default mongoose.models.AuditEvent ?? mongoose.model('AuditEvent', auditEventSchema)
