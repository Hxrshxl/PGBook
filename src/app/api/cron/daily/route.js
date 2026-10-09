import crypto from 'node:crypto'
import { NextResponse } from 'next/server'
import dbConnect from '@/lib/db'
import { runDailyJobs } from '@/lib/cronJobs'
import { recordAudit, SYSTEM_ACTOR } from '@/lib/audit'

// Daily jobs: trial / payment / retention reminders, payment-claim reminders,
// complaint auto-close. Vercel Cron calls it with "Authorization: Bearer $CRON_SECRET"
// (see vercel.json); any other scheduler can do the same.
function authorized(request) {
  const secret = process.env.CRON_SECRET
  if (!secret || secret.length < 16) return false
  const given = Buffer.from(request.headers.get('authorization') ?? '')
  const expected = Buffer.from(`Bearer ${secret}`)
  return given.length === expected.length && crypto.timingSafeEqual(given, expected)
}

export async function GET(request) {
  if (!authorized(request)) return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 })
  await dbConnect()
  const startedAt = Date.now()
  const results = await runDailyJobs()
  await recordAudit({ actor: SYSTEM_ACTOR, action: 'system.daily_jobs', details: { ...results, ms: Date.now() - startedAt } })
  return NextResponse.json({ ok: true, results })
}
