import mongoose from 'mongoose'

// Webhook deliveries already processed, so a retried delivery is applied only once.
const webhookEventSchema = new mongoose.Schema({
  _id:        { type: String },             // provider's event id
  provider:   { type: String, required: true },
  type:       { type: String, default: '' },
  receivedAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 30 }, // kept 30 days
}, { versionKey: false })

export default mongoose.models.WebhookEvent ?? mongoose.model('WebhookEvent', webhookEventSchema)
