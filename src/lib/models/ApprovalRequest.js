import mongoose from 'mongoose'

export const APPROVAL_STATUSES = ['pending', 'approved', 'rejected', 'cancelled', 'expired', 'failed']
export const APPROVAL_TTL_MS = 72 * 60 * 60 * 1000

const actorSchema = new mongoose.Schema({
  realm: { type: String, required: true },
  id:    { type: mongoose.Schema.Types.ObjectId, required: true },
  name:  { type: String, default: '' },
  role:  { type: String, default: '' },
}, { _id: false })

// Maker-checker: one person asks, a different person with authority decides.
// The payload is re-validated when it executes, so a stale approval can't apply to changed data.
const approvalRequestSchema = new mongoose.Schema({
  type:         { type: String, required: true },
  payload:      { type: mongoose.Schema.Types.Mixed, default: {} },
  summary:      { type: String, required: true },
  reason:       { type: String, required: [true, 'A reason is required.'], trim: true, minlength: [3, 'Please give a reason.'], maxlength: 1000 },
  status:       { type: String, enum: APPROVAL_STATUSES, default: 'pending' },
  requestedBy:  { type: actorSchema, required: true },
  decidedBy:    { type: actorSchema, default: undefined },
  decisionNote: { type: String, default: '', maxlength: 1000 },
  decidedAt:    { type: Date, default: null },
  executedAt:   { type: Date, default: null },
  error:        { type: String, default: '' },
  orgId:        { type: mongoose.Schema.Types.ObjectId, default: null },
  expiresAt:    { type: Date, default: () => new Date(Date.now() + APPROVAL_TTL_MS) },
}, { timestamps: true })

approvalRequestSchema.index({ status: 1, createdAt: -1 })
approvalRequestSchema.index({ 'requestedBy.id': 1, createdAt: -1 })

approvalRequestSchema.set('toJSON', {
  transform: (_, ret) => {
    ret.id = ret._id.toString()
    ret.orgId = ret.orgId?.toString() ?? null
    if (ret.requestedBy?.id) ret.requestedBy.id = ret.requestedBy.id.toString()
    if (ret.decidedBy?.id) ret.decidedBy.id = ret.decidedBy.id.toString()
    delete ret._id
    delete ret.__v
    return ret
  },
})

export default mongoose.models.ApprovalRequest ?? mongoose.model('ApprovalRequest', approvalRequestSchema)
