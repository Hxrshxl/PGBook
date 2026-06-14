import { NextResponse } from 'next/server'
import dbConnect from '@/lib/db'
import Payment from '@/lib/models/Payment'
import { getUserFromRequest } from '@/lib/auth'

export async function PUT(request, { params }) {
  await dbConnect()
  const auth = getUserFromRequest(request)
  if (!auth) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const payment = await Payment.findOneAndUpdate(
    { _id: params.id, userId: auth.id },
    body,
    { new: true, runValidators: true }
  )
  if (!payment) return NextResponse.json({ message: 'Payment not found' }, { status: 404 })
  return NextResponse.json(payment)
}
