import { NextResponse } from 'next/server'
import dbConnect from '@/lib/db'
import User from '@/lib/models/User'
import { signToken } from '@/lib/auth'

export async function POST(request) {
  await dbConnect()
  const { name, pgName, email, password } = await request.json()

  if (!name || !email || !password) {
    return NextResponse.json({ message: 'Name, email, and password are required.' }, { status: 400 })
  }

  const existing = await User.findOne({ email: email.toLowerCase().trim() })
  if (existing) return NextResponse.json({ message: 'An account with this email already exists.' }, { status: 409 })

  const user = await User.create({
    name: name.trim(),
    email: email.toLowerCase().trim(),
    password,
    pgName: pgName?.trim() ?? '',
    pgSettings: {
      pgName:    pgName?.trim() ?? '',
      ownerName: name.trim(),
      logoText:  pgName?.trim() || 'PGBook',
    },
  })

  const token = signToken({ id: user._id.toString(), email: user.email })
  return NextResponse.json({ token, user: user.toJSON() }, { status: 201 })
}
