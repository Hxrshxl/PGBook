import mongoose from 'mongoose'

// Gap-free sequences (invoice numbers per financial year), incremented atomically.
const counterSchema = new mongoose.Schema({
  _id: { type: String },
  seq: { type: Number, default: 0 },
}, { versionKey: false })

export async function nextSequence(name) {
  const doc = await Counter.findOneAndUpdate({ _id: name }, { $inc: { seq: 1 } }, { new: true, upsert: true })
  return doc.seq
}

const Counter = mongoose.models.Counter ?? mongoose.model('Counter', counterSchema)
export default Counter
