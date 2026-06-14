import { NextResponse } from 'next/server'
import dbConnect from '@/lib/db'
import User from '@/lib/models/User'
import { signToken } from '@/lib/auth'

export async function POST(request) {
  await dbConnect()
  const { email, password } = await request.json()

  const user = await User.findOne({ email: email?.toLowerCase().trim() })
  if (!user) return NextResponse.json({ message: 'Invalid email or password.' }, { status: 401 })

  const match = await user.comparePassword(password)
  if (!match) return NextResponse.json({ message: 'Invalid email or password.' }, { status: 401 })

  const payload = { id: user._id.toString(), email: user.email }
  const token = signToken(payload)
  const userJson = user.toJSON()

  return NextResponse.json({ token, user: userJson })
}
