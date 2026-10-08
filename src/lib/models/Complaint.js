import mongoose from 'mongoose'

export const COMPLAINT_CATEGORIES = ['plumbing', 'electrical', 'wifi', 'furniture', 'cleaning', 'security', 'noise', 'other']
export const COMPLAINT_STATUSES = ['open', 'in-progress', 'resolved']
export const COMPLAINT_PRIORITIES = ['high', 'medium', 'low']

const complaintSchema = new mongoose.Schema({
  userId:      { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User', index: true },
  tenantId:    { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Tenant' },
  tenantName:  { type: String, default: '' },
  room:        { type: String, default: '' },
  category:    { type: String, enum: { values: COMPLAINT_CATEGORIES, message: 'Unknown category.' }, default: 'other' },
  description: { type: String, required: [true, 'Please describe the issue.'], trim: true, maxlength: [2000, 'Description is too long.'] },
  status:      { type: String, enum: { values: COMPLAINT_STATUSES, message: 'Unknown status.' }, default: 'open' },
  priority:    { type: String, enum: { values: COMPLAINT_PRIORITIES, message: 'Unknown priority.' }, default: 'medium' },
  ownerNotes:  { type: String, default: '', trim: true, maxlength: [1000, 'Notes are too long.'] },
  resolvedAt:  { type: Date, default: null },
}, { timestamps: true })

complaintSchema.set('toJSON', {
  transform: (_, ret) => {
    ret.id = ret._id.toString()
    ret.tenantId = ret.tenantId?.toString()
    delete ret._id
    delete ret.__v
    delete ret.userId
    return ret
  },
})

export default mongoose.models.Complaint ?? mongoose.model('Complaint', complaintSchema)
