import { NextResponse } from 'next/server'
import dbConnect from '@/lib/db'
import User from '@/lib/models/User'
import { getUserFromRequest } from '@/lib/auth'

export async function GET(request) {
  await dbConnect()
  const auth = getUserFromRequest(request)
  if (!auth) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

  const user = await User.findById(auth.id).select('pgSettings pgName')
  if (!user) return NextResponse.json({ message: 'User not found' }, { status: 404 })
  return NextResponse.json(user.pgSettings ?? {})
}

export async function PUT(request) {
  await dbConnect()
  const auth = getUserFromRequest(request)
  if (!auth) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const user = await User.findByIdAndUpdate(
    auth.id,
    { pgSettings: body, ...(body.pgName ? { pgName: body.pgName } : {}) },
    { new: true }
  )
  return NextResponse.json(user.pgSettings)
}
