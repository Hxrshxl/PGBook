import { NextResponse } from 'next/server'
import dbConnect from '@/lib/db'
import UtilityBill from '@/lib/models/UtilityBill'
import { getUserFromRequest } from '@/lib/auth'

export async function DELETE(request, { params }) {
  await dbConnect()
  const auth = getUserFromRequest(request)
  if (!auth) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

  const bill = await UtilityBill.findOneAndDelete({ _id: params.id, userId: auth.id })
  if (!bill) return NextResponse.json({ message: 'Bill not found' }, { status: 404 })
  return NextResponse.json({ message: 'Deleted' })
}
