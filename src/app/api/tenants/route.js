import { NextResponse } from 'next/server'
import dbConnect from '@/lib/db'
import Tenant from '@/lib/models/Tenant'
import { getUserFromRequest } from '@/lib/auth'

export async function GET(request) {
  await dbConnect()
  const auth = getUserFromRequest(request)
  if (!auth) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

  const tenants = await Tenant.find({ userId: auth.id }).sort({ createdAt: 1 })
  return NextResponse.json(tenants)
}

export async function POST(request) {
  await dbConnect()
  const auth = getUserFromRequest(request)
  if (!auth) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const tenant = await Tenant.create({ ...body, userId: auth.id })
  return NextResponse.json(tenant, { status: 201 })
}
