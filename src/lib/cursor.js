import mongoose from 'mongoose'

// Keyset pagination for newest-first lists: cursor = "<createdAt ISO>_<_id>".
export function cursorFilter(cursor) {
  if (!cursor) return {}
  const [iso, id] = String(cursor).split('_')
  const at = new Date(iso)
  if (Number.isNaN(at.getTime()) || !mongoose.isValidObjectId(id)) return {}
  const oid = new mongoose.Types.ObjectId(id)
  return { $or: [{ createdAt: { $lt: at } }, { createdAt: at, _id: { $lt: oid } }] }
}

export function nextCursor(docs, limit) {
  if (docs.length <= limit) return null
  const last = docs[limit - 1]
  return `${last.createdAt.toISOString()}_${last._id}`
}
