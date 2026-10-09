import mongoose from 'mongoose'

let cached = global._mongoose ?? { conn: null, promise: null }
global._mongoose = cached

export default async function dbConnect() {
  const URI = process.env.MONGODB_URI
  if (!URI) throw new Error('MONGODB_URI is not set. Copy .env.example to .env.local and fill it in.')
  if (cached.conn) return cached.conn
  if (!cached.promise) {
    cached.promise = mongoose
      .connect(URI, { bufferCommands: false, serverSelectionTimeoutMS: 10000 })
      .catch(err => {
        cached.promise = null // allow a retry on the next request
        throw err
      })
  }
  cached.conn = await cached.promise
  return cached.conn
}
