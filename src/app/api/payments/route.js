import { NextResponse } from 'next/server'
import dbConnect from '@/lib/db'
import Payment from '@/lib/models/Payment'
import { getUserFromRequest } from '@/lib/auth'

export async function GET(request) {
  await dbConnect()
  const auth = getUserFromRequest(request)
  if (!auth) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

  const payments = await Payment.find({ userId: auth.id }).sort({ createdAt: -1 })
  return NextResponse.json(payments)
}

export async function POST(request) {
  await dbConnect()
  const auth = getUserFromRequest(request)
  if (!auth) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const payment = await Payment.create({ ...body, userId: auth.id })
  return NextResponse.json(payment, { status: 201 })
}
