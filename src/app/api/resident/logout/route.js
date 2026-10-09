import { NextResponse } from 'next/server'
import { clearResidentCookie } from '@/lib/auth'

export async function POST() {
  return clearResidentCookie(NextResponse.json({ ok: true }))
}
