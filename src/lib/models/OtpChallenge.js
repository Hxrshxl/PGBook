import mongoose from 'mongoose'

// A one-time login code sent to a phone. Only a keyed hash of the code is stored.
const otpChallengeSchema = new mongoose.Schema({
  phone:      { type: String, required: true, index: true },
  codeHash:   { type: String, required: true },
  attempts:   { type: Number, default: 0 },
  consumedAt: { type: Date, default: null },
  expiresAt:  { type: Date, required: true, expires: 60 * 60 }, // the record itself disappears an hour after expiry
}, { timestamps: { createdAt: true, updatedAt: false } })

export default mongoose.models.OtpChallenge ?? mongoose.model('OtpChallenge', otpChallengeSchema)
