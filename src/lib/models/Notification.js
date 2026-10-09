import mongoose from 'mongoose'

// In-app notifications.
//  • audience 'org': shown to everyone in the organization who has `capability`
//    (owner-only things use an owner-only capability such as billing.manage).
//  • audience 'resident': shown to one resident in the tenant app.
// `key` makes scheduled reminders idempotent: the same reminder is created once.
const notificationSchema = new mongoose.Schema({
  audience:   { type: String, enum: ['org', 'resident'], required: true },
  orgId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  capability: { type: String, default: null },
  residentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Resident', default: null, index: true },
  type:       { type: String, required: true },
  title:      { type: String, required: true, maxlength: 200 },
  body:       { type: String, default: '', maxlength: 1000 },
  link:       { type: String, default: '' },
  tone:       { type: String, enum: ['info', 'success', 'warning', 'danger'], default: 'info' },
  key:        { type: String, default: undefined },
  readBy:     { type: [mongoose.Schema.Types.ObjectId], default: [] },
}, { timestamps: true })

notificationSchema.index({ key: 1 }, { unique: true, sparse: true })
notificationSchema.index({ orgId: 1, createdAt: -1 })
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 120 }) // auto-clean after 120 days

export default mongoose.models.Notification ?? mongoose.model('Notification', notificationSchema)
