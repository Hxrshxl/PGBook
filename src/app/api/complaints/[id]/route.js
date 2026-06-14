import { NextResponse } from 'next/server'
import dbConnect from '@/lib/db'
import Complaint from '@/lib/models/Complaint'
import { getUserFromRequest } from '@/lib/auth'

export async function PATCH(request, { params }) {
  await dbConnect()
  const auth = getUserFromRequest(request)
  if (!auth) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

  const { status, ownerNotes } = await request.json()
  const updates = { status, ownerNotes }
  if (status === 'resolved') updates.resolvedAt = new Date().toISOString()

  const complaint = await Complaint.findOneAndUpdate(
    { _id: params.id, userId: auth.id },
    updates,
    { new: true }
  )
  if (!complaint) return NextResponse.json({ message: 'Complaint not found' }, { status: 404 })
  return NextResponse.json(complaint)
}
