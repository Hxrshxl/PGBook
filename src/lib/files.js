// Photos uploaded from the tenant app (complaints, payment screenshots), stored in
// MongoDB GridFS so no separate storage service is needed. Only JPEG, PNG and WebP
// are accepted, checked by their actual bytes, not the file name.
import mongoose from 'mongoose'
import { ApiError } from './api.js'

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024
const BUCKET = 'uploads'

function bucket() {
  return new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: BUCKET })
}
const filesCollection = () => mongoose.connection.db.collection(`${BUCKET}.files`)

/** The image type from the file's first bytes, or null. */
export function sniffImage(buf) {
  if (buf.length >= 3 && buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return 'image/jpeg'
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]))) return 'image/png'
  if (buf.length >= 12 && buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP') return 'image/webp'
  return null
}

/** Saves an uploaded File/Blob. metadata: { orgId, propertyId, tenantId, residentId }. Returns the file id. */
export async function saveUpload(file, metadata) {
  if (!file || typeof file.arrayBuffer !== 'function') throw new ApiError(400, 'Choose a photo to upload.')
  if (file.size > MAX_UPLOAD_BYTES) throw new ApiError(413, 'Photos can be at most 5 MB.')
  const buf = Buffer.from(await file.arrayBuffer())
  const contentType = sniffImage(buf)
  if (!contentType) throw new ApiError(415, 'Only JPEG, PNG or WebP photos can be uploaded.')
  const id = new mongoose.Types.ObjectId()
  await new Promise((resolve, reject) => {
    const stream = bucket().openUploadStreamWithId(id, `${id}.${contentType.split('/')[1]}`, {
      metadata: { ...metadata, contentType, attachedTo: null, uploadedAt: new Date() },
    })
    stream.on('error', reject).on('finish', resolve)
    stream.end(buf)
  })
  return id
}

export async function uploadInfo(id) {
  if (!mongoose.isValidObjectId(id)) return null
  return filesCollection().findOne({ _id: new mongoose.Types.ObjectId(String(id)) })
}

export async function readUpload(id) {
  const info = await uploadInfo(id)
  if (!info) return null
  const chunks = []
  await new Promise((resolve, reject) => {
    bucket().openDownloadStream(info._id).on('data', c => chunks.push(c)).on('error', reject).on('end', resolve)
  })
  return { info, buffer: Buffer.concat(chunks) }
}

/**
 * Attaches the resident's own, not-yet-used uploads to a record (complaint or claim).
 * Throws if any id isn't theirs or is already attached elsewhere.
 */
export async function attachUploads(ids, { tenantId, kind, recordId, max = 3 }) {
  const list = [...new Set((ids ?? []).map(String))]
  if (list.length > max) throw new ApiError(400, `At most ${max} photo${max === 1 ? '' : 's'}.`)
  if (!list.every(id => mongoose.isValidObjectId(id))) throw new ApiError(400, 'Invalid photo.')
  const oids = list.map(id => new mongoose.Types.ObjectId(id))
  if (!oids.length) return []
  const owned = await filesCollection().countDocuments({ _id: { $in: oids }, 'metadata.tenantId': tenantId, 'metadata.attachedTo': null })
  if (owned !== oids.length) throw new ApiError(400, 'One of the photos could not be found. Please upload it again.')
  await filesCollection().updateMany({ _id: { $in: oids } }, { $set: { 'metadata.attachedTo': { kind, id: recordId } } })
  return oids
}

export async function deleteUploads(ids) {
  for (const id of ids ?? []) {
    try {
      await bucket().delete(new mongoose.Types.ObjectId(String(id)))
    } catch { /* already gone */ }
  }
}
