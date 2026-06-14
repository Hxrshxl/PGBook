import { NextResponse } from 'next/server'
import dbConnect from '@/lib/db'
import Complaint from '@/lib/models/Complaint'
import { getUserFromRequest } from '@/lib/auth'

export async function GET(request) {
  await dbConnect()
  const auth = getUserFromRequest(request)
  if (!auth) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

  const complaints = await Complaint.find({ userId: auth.id }).sort({ createdAt: -1 })
  return NextResponse.json(complaints)
}

export async function POST(request) {
  await dbConnect()
  const auth = getUserFromRequest(request)
  if (!auth) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const complaint = await Complaint.create({ ...body, userId: auth.id })
  return NextResponse.json(complaint, { status: 201 })
}
