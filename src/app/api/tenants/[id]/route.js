import { NextResponse } from 'next/server'
import dbConnect from '@/lib/db'
import Tenant from '@/lib/models/Tenant'
import { getUserFromRequest } from '@/lib/auth'

export async function PUT(request, { params }) {
  await dbConnect()
  const auth = getUserFromRequest(request)
  if (!auth) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const tenant = await Tenant.findOneAndUpdate(
    { _id: params.id, userId: auth.id },
    body,
    { new: true, runValidators: true }
  )
  if (!tenant) return NextResponse.json({ message: 'Tenant not found' }, { status: 404 })
  return NextResponse.json(tenant)
}

export async function PATCH(request, { params }) {
  await dbConnect()
  const auth = getUserFromRequest(request)
  if (!auth) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

  const tenant = await Tenant.findOneAndUpdate(
    { _id: params.id, userId: auth.id },
    { status: 'vacated', moveOutDate: new Date().toISOString().split('T')[0] },
    { new: true }
  )
  if (!tenant) return NextResponse.json({ message: 'Tenant not found' }, { status: 404 })
  return NextResponse.json(tenant)
}
