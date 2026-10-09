import crypto from 'node:crypto'
import { NextResponse } from 'next/server'
import dbConnect from '@/lib/db'
import WebhookEvent from '@/lib/models/WebhookEvent'
import { parseRazorpayEvent, verifyWebhookSignature } from '@/lib/billingProvider'
import { applyBillingEvent } from '@/lib/billingEvents'

// Razorpay subscription webhooks. The signature proves the body came from Razorpay;
// the event id makes redelivery harmless. A 500 makes Razorpay retry later.
export async function POST(request) {
  const raw = await request.text()
  if (!verifyWebhookSignature(raw, request.headers.get('x-razorpay-signature'))) {
    return NextResponse.json({ message: 'Invalid signature.' }, { status: 400 })
  }
  let body
  try {
    body = JSON.parse(raw)
  } catch {
    return NextResponse.json({ message: 'Invalid JSON.' }, { status: 400 })
  }

  await dbConnect()
  const eventId = request.headers.get('x-razorpay-event-id') || crypto.createHash('sha256').update(raw).digest('hex')
  try {
    await WebhookEvent.create({ _id: eventId, provider: 'razorpay', type: String(body.event ?? '') })
  } catch (err) {
    if (err?.code === 11000) return NextResponse.json({ ok: true, duplicate: true })
    throw err
  }

  try {
    const result = await applyBillingEvent(parseRazorpayEvent(body), { provider: 'razorpay' })
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    console.error('[billing webhook] failed', body.event, err)
    await WebhookEvent.deleteOne({ _id: eventId }) // let the retry run it again
    return NextResponse.json({ message: 'Could not process the event.' }, { status: 500 })
  }
}
