import { NextResponse } from 'next/server'
import dbConnect from '@/lib/db'
import UtilityBill from '@/lib/models/UtilityBill'
import Payment from '@/lib/models/Payment'
import { getUserFromRequest } from '@/lib/auth'

function calcStatus(paid, total) {
  if (paid >= total) return 'paid'
  if (paid > 0) return 'partial'
  return 'pending'
}

export async function GET(request) {
  await dbConnect()
  const auth = getUserFromRequest(request)
  if (!auth) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

  const bills = await UtilityBill.find({ userId: auth.id }).sort({ createdAt: -1 })
  return NextResponse.json(bills)
}

export async function POST(request) {
  await dbConnect()
  const auth = getUserFromRequest(request)
  if (!auth) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const bill = await UtilityBill.create({ ...body, userId: auth.id })

  // Update all payments for this month — add perTenantAmount to utilityShare
  const payments = await Payment.find({ userId: auth.id, month: bill.month })
  const updatedPayments = await Promise.all(
    payments.map(async p => {
      const newShare = (p.utilityShare ?? 0) + bill.perTenantAmount
      const newStatus = calcStatus(p.amountPaid ?? 0, (p.rentAmount ?? 0) + newShare)
      return Payment.findByIdAndUpdate(
        p._id,
        { utilityShare: newShare, status: newStatus },
        { new: true }
      )
    })
  )

  return NextResponse.json({ bill, updatedPayments }, { status: 201 })
}
