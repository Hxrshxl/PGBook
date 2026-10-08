import mongoose from 'mongoose'
import dbConnect from '@/lib/db'

export const dynamic = 'force-dynamic'

// Used by uptime monitors / load balancers.
export async function GET() {
  try {
    await dbConnect()
    await mongoose.connection.db.admin().ping()
    return Response.json({ status: 'ok' })
  } catch {
    return Response.json({ status: 'error', db: 'unreachable' }, { status: 503 })
  }
}
