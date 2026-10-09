// End-to-end test of Phase 2: plans and limits, read-only mode, Razorpay subscriptions
// (against a fake Razorpay API this script runs), signed webhooks, GST invoices, dunning,
// cancellation, data export and the daily reminder job.
// Use a THROWAWAY database (name must contain "test"); it is dropped at the end.
//
// Start the server with these settings (they must match the constants below):
//   MONGODB_URI=mongodb://127.0.0.1:27017/pgbook_billing_test
//   RAZORPAY_KEY_ID=rzp_test_e2e RAZORPAY_KEY_SECRET=e2e_key_secret RAZORPAY_WEBHOOK_SECRET=e2e_webhook_secret
//   RAZORPAY_API_BASE=http://127.0.0.1:3459/v1
//   RAZORPAY_PLAN_STARTER_MONTHLY=plan_starter_m RAZORPAY_PLAN_PRO_MONTHLY=plan_pro_m RAZORPAY_PLAN_MULTI_MONTHLY=plan_multi_m
//   BILLING_GSTIN=29ABCDE1234F1Z5 BILLING_STATE_CODE=29 CRON_SECRET=e2e-cron-secret-0123456789
// then:
//   MONGODB_URI=… BASE_URL=http://localhost:3000 node scripts/billing-smoke-test.mjs
import http from 'node:http'
import crypto from 'node:crypto'
import mongoose from 'mongoose'
import { readZip } from '../src/lib/zip.js'

const BASE = (process.env.BASE_URL ?? 'http://localhost:3000') + '/api'
const DB = process.env.MONGODB_URI
const FAKE_PORT = Number(process.env.FAKE_RAZORPAY_PORT ?? 3459)
const KEY = { id: 'rzp_test_e2e', secret: 'e2e_key_secret', webhook: 'e2e_webhook_secret' }
const CRON_SECRET = 'e2e-cron-secret-0123456789'
if (!DB || !/test|smoke|tmp/i.test(DB)) {
  console.error('Set MONGODB_URI to a throwaway database (name must contain "test").')
  process.exit(1)
}
const run = Date.now().toString(36)
let passes = 0
let failures = 0
function check(name, ok, detail = '') {
  if (ok) { passes++; console.log(`  ✓ ${name}`) } else { failures++; console.log(`  ✗ ${name}${detail ? ` — ${typeof detail === 'string' ? detail : JSON.stringify(detail)}` : ''}`) }
}

function client() {
  const jar = new Map()
  return async function call(method, path, body, { raw = false, headers = {} } = {}) {
    const res = await fetch(BASE + path, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(jar.size ? { Cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; ') } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
    })
    for (const c of res.headers.getSetCookie()) {
      const [pair] = c.split(';')
      const [name, ...v] = pair.split('=')
      if (!v.join('=') || /max-age=0/i.test(c)) jar.delete(name)
      else jar.set(name, v.join('='))
    }
    if (raw) return { status: res.status, buffer: Buffer.from(await res.arrayBuffer()), headers: res.headers }
    return { status: res.status, data: await res.json().catch(() => null) }
  }
}

// ── Fake Razorpay ─────────────────────────────────────────────
const fake = { created: [], cancelled: [], fetched: 0, status: new Map(), authOk: true }
const server = http.createServer(async (req, res) => {
  let body = ''
  for await (const chunk of req) body += chunk
  const expected = `Basic ${Buffer.from(`${KEY.id}:${KEY.secret}`).toString('base64')}`
  if (req.headers.authorization !== expected) fake.authOk = false
  const send = (code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)) }
  const m = /^\/v1\/subscriptions(?:\/([^/]+))?(\/cancel)?$/.exec(req.url)
  if (!m) return send(404, { error: { description: 'not found' } })
  if (req.method === 'POST' && !m[1]) {
    const data = JSON.parse(body)
    const id = `sub_${run}_${fake.created.length + 1}`
    fake.created.push({ id, ...data })
    return send(200, { id, short_url: `https://rzp.io/i/${id}`, status: 'created', notes: data.notes })
  }
  if (req.method === 'POST' && m[2]) {
    fake.cancelled.push({ id: m[1], ...JSON.parse(body || '{}') })
    return send(200, { id: m[1], status: 'cancelled' })
  }
  if (req.method === 'GET' && m[1]) {
    fake.fetched++
    const sub = fake.created.find(s => s.id === m[1])
    return send(200, { id: m[1], status: fake.status.get(m[1]) ?? 'created', notes: sub?.notes ?? {}, current_start: Math.floor(Date.now() / 1000), current_end: Math.floor(Date.now() / 1000) + 30 * 86400 })
  }
  send(404, {})
})
await new Promise(resolve => server.listen(FAKE_PORT, '127.0.0.1', resolve))

let eventSeq = 0
async function webhook(event, sub, payment, { sign = true, eventId } = {}) {
  const now = Math.floor(Date.now() / 1000)
  const body = JSON.stringify({
    entity: 'event', event, created_at: now,
    payload: {
      subscription: { entity: { id: sub.id, status: 'active', notes: sub.notes, current_start: now, current_end: now + 30 * 86400 } },
      ...(payment ? { payment: { entity: { id: payment.id, amount: payment.amount, status: 'captured' } } } : {}),
    },
  })
  const signature = sign ? crypto.createHmac('sha256', KEY.webhook).update(body).digest('hex') : 'deadbeef'
  const res = await fetch(`${BASE}/billing/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-razorpay-signature': signature, 'x-razorpay-event-id': eventId ?? `evt_${run}_${++eventSeq}` },
    body,
  })
  return { status: res.status, data: await res.json().catch(() => null) }
}

await mongoose.connect(DB)
const db = mongoose.connection.db
const users = db.collection('users')
let r
try {
  console.log('\nTrial and plan limits')
  const owner = client()
  const email = `bill-${run}@test.com`
  r = await owner('POST', '/auth/signup', { name: 'Billing Owner', pgName: 'Lotus PG', email, password: 'owner-pass-123' })
  check('owner signs up', r.status === 201)
  const orgId = new mongoose.Types.ObjectId(r.data.user.id)
  r = await owner('GET', '/billing')
  check('new account is on the free trial', r.status === 200 && r.data.state.status === 'trialing' && r.data.state.daysLeft === 14, r.data?.state)
  check('trial includes Multi-PG limits', r.data.limits.properties === 5 && r.data.limits.staff === 10)
  check('Razorpay is the provider', r.data.provider === 'razorpay', r.data.provider)
  r = await owner('GET', '/auth/me')
  check('me exposes billing state', r.data.access.billing.status === 'trialing' && r.data.access.billing.readOnly === false)

  // A staff member, used later to check read-only mode for staff
  r = await owner('POST', '/team', { name: 'Accountant', email: `acc-${run}@test.com`, role: 'accountant' })
  check('trial can invite staff', r.status === 201, r.data)
  const staff = client()
  r = await staff('POST', '/join', { token: new URL(r.data.inviteUrl).searchParams.get('token'), name: 'Accountant', password: 'staff-pass-123' })
  check('staff joins', r.status === 201)

  const [property] = (await owner('GET', '/properties')).data
  r = await owner('POST', '/tenants', { name: 'T One', phone: '9000001001', room: 'A1', rentAmount: 8000, moveInDate: `${new Date().toISOString().slice(0, 7)}-01` })
  check('trial can add tenants', r.status === 201)

  // Starter: 10 tenants, 1 property, no staff
  await users.updateOne({ _id: orgId }, { $set: { plan: 'starter', billing: { status: 'active', provider: 'manual', interval: 'monthly', details: {} } } })
  r = await owner('POST', '/properties', { name: 'Second PG' })
  check('Starter: second property refused with PLAN_LIMIT', r.status === 403 && r.data.code === 'PLAN_LIMIT', r.data)
  r = await owner('POST', '/team', { name: 'X', email: `x-${run}@test.com`, role: 'caretaker' })
  check('Starter: staff invites refused', r.status === 403 && r.data.code === 'PLAN_LIMIT')
  await db.collection('tenants').insertMany(Array.from({ length: 9 }, (_, i) => ({
    userId: orgId, propertyId: new mongoose.Types.ObjectId(property.id), name: `Bulk ${i}`, phone: `90000020${String(i).padStart(2, '0')}`,
    phoneKey: `9190000020${String(i).padStart(2, '0')}`, room: 'B1', rentAmount: 5000, status: 'active', recurringCharges: [],
  })))
  r = await owner('POST', '/tenants', { name: 'Eleventh', phone: '9000001011', room: 'A2', rentAmount: 8000 })
  check('Starter: 11th tenant refused, with an upgrade hint', r.status === 403 && /Pro/.test(r.data.message), r.data)
  r = await owner('GET', '/billing')
  check('usage is counted', r.data.usage.tenants === 10 && r.data.usage.staff === 1)
  check('plans that would not fit are explained', /staff/.test(r.data.plans.find(p => p.id === 'starter').blocker ?? ''))
  await db.collection('tenants').deleteMany({ userId: orgId, name: /^Bulk / })
  await users.updateOne({ _id: orgId }, { $set: { plan: 'trial', billing: { details: {} } } })

  console.log('\nSubscribing through Razorpay')
  r = await owner('POST', '/properties', { name: 'Second PG' })
  check('trial: second property allowed', r.status === 201)
  const second = r.data.id
  r = await owner('POST', '/billing/subscribe', { plan: 'pro', interval: 'monthly' })
  check('Pro refused while 2 properties exist', r.status === 409 && /2 properties/.test(r.data.message), r.data)
  await owner('DELETE', `/properties/${second}`)
  r = await owner('POST', '/billing/subscribe', { plan: 'pro', interval: 'monthly' })
  check('checkout starts', r.status === 200 && r.data.checkoutUrl.startsWith('https://rzp.io/'), r.data)
  const sub1 = fake.created[0]
  check('Razorpay got the right plan and our org id', sub1?.plan_id === 'plan_pro_m' && sub1.notes.orgId === String(orgId) && sub1.total_count === 120)
  check('Razorpay API called with our key', fake.authOk)
  r = await owner('GET', '/billing')
  check('plan only changes after payment', r.data.state.plan === 'trial' && r.data.subscription.pending?.plan === 'pro')

  r = await webhook('subscription.charged', sub1, { id: `pay_${run}_1`, amount: 49900 }, { sign: false })
  check('webhook with a bad signature is rejected', r.status === 400)
  const firstEventId = `evt_${run}_first`
  r = await webhook('subscription.charged', sub1, { id: `pay_${run}_1`, amount: 49900 }, { eventId: firstEventId })
  check('signed webhook accepted', r.status === 200 && r.data.switched === true, r.data)
  r = await owner('GET', '/billing')
  check('now on Pro, active', r.data.state.plan === 'pro' && r.data.state.status === 'active' && !!r.data.state.currentPeriodEnd, r.data.state)
  check('one invoice issued', r.data.invoices.length === 1 && r.data.invoices[0].total === 499)
  const inv1 = (await owner('GET', `/billing/invoices/${r.data.invoices[0].id}`)).data
  check('invoice number is per financial year', /^PGB\/\d{4}-\d{2}\/\d{5}$/.test(inv1.number), inv1.number)
  check('same-state GST split (CGST + SGST)', inv1.taxable === 422.88 && inv1.cgst === 38.06 && inv1.sgst === 38.06 && inv1.igst === 0, inv1)
  r = await webhook('subscription.charged', sub1, { id: `pay_${run}_1`, amount: 49900 }, { eventId: firstEventId })
  check('redelivered webhook is ignored', r.status === 200 && r.data.duplicate === true)
  await webhook('subscription.activated', sub1, null)
  await webhook('subscription.charged', sub1, { id: `pay_${run}_1`, amount: 49900 })
  r = await owner('GET', '/billing')
  check('same payment never makes a second invoice', r.data.invoices.length === 1)
  r = await owner('GET', '/notifications')
  check('owner notified about the subscription', r.data.notifications.some(n => n.type === 'billing.subscribed'))

  r = await owner('PUT', '/billing', { legalName: 'Lotus Hospitality', gstin: '27ABCDE1234F1Z5', stateCode: '27', address: 'Pune' })
  check('billing details saved', r.status === 200 && r.data.details.stateCode === '27')
  r = await owner('PUT', '/billing', { gstin: 'NOT-A-GSTIN' })
  check('invalid GSTIN refused', r.status === 400)
  await webhook('subscription.charged', sub1, { id: `pay_${run}_2`, amount: 49900 })
  r = await owner('GET', '/billing')
  const inv2 = (await owner('GET', `/billing/invoices/${r.data.invoices[0].id}`)).data
  check('renewal for an out-of-state business uses IGST', inv2.igst === 76.12 && inv2.cgst === 0 && inv2.buyer.gstin === '27ABCDE1234F1Z5', inv2)
  check('invoice numbers are sequential', Number(inv2.number.slice(-5)) === Number(inv1.number.slice(-5)) + 1)

  console.log('\nChanging plan')
  r = await owner('POST', '/billing/subscribe', { plan: 'pro', interval: 'monthly' })
  check('subscribing to the current plan is refused', r.status === 409)
  r = await owner('POST', '/billing/subscribe', { plan: 'multi', interval: 'monthly' })
  const sub2 = fake.created[1]
  check('upgrade starts a new subscription', r.status === 200 && sub2?.plan_id === 'plan_multi_m')
  await webhook('subscription.charged', sub2, { id: `pay_${run}_3`, amount: 99900 })
  r = await owner('GET', '/billing')
  check('now on Multi-PG', r.data.state.plan === 'multi' && r.data.limits.properties === 5)
  check('old subscription cancelled immediately', fake.cancelled.some(c => c.id === sub1.id && c.cancel_at_cycle_end === 0))
  await webhook('subscription.charged', sub1, { id: `pay_${run}_late`, amount: 49900 })
  r = await owner('GET', '/billing')
  check('a late event for the old subscription changes nothing', r.data.state.plan === 'multi' && r.data.invoices.length === 3)

  console.log('\nFailed payments and read-only mode')
  await webhook('subscription.pending', sub2, null)
  r = await owner('GET', '/auth/me')
  check('payment failure → past due, still writable, warning banner', r.data.access.billing.status === 'past_due' && !r.data.access.billing.readOnly && r.data.access.billing.notice?.tone === 'warning')
  r = await owner('POST', '/tenants', { name: 'T Two', phone: '9000001002', room: 'A2', rentAmount: 8000 })
  check('changes still allowed during the grace period', r.status === 201)
  await users.updateOne({ _id: orgId }, { $set: { 'billing.pastDueSince': new Date(Date.now() - 15 * 86400000) } })
  r = await owner('POST', '/tenants', { name: 'T Three', phone: '9000001003', room: 'A3', rentAmount: 8000 })
  check('after 14 days unpaid: changes refused (402 READ_ONLY)', r.status === 402 && r.data.code === 'READ_ONLY', r.data)
  r = await staff('POST', '/expenses', { amount: 100, date: new Date().toISOString().slice(0, 10), category: 'other' })
  check('staff are read-only too, and told to ask the owner', r.status === 402 && /owner/.test(r.data.message))
  r = await owner('GET', '/tenants')
  check('viewing still works', r.status === 200 && r.data.length >= 2)
  r = await owner('PUT', '/auth/me', { name: 'Billing Owner' })
  check('own profile can still be edited', r.status === 200)
  r = await owner('POST', '/export', { password: 'wrong-password' }, { raw: true })
  check('export needs the password', r.status === 403)
  r = await owner('POST', '/export', { password: 'owner-pass-123' }, { raw: true })
  const files = r.status === 200 ? readZip(r.buffer) : []
  check('export works in read-only mode', r.status === 200 && r.headers.get('content-type') === 'application/zip')
  check('export contains every area', ['tenants.csv', 'dues.csv', 'payments_received.csv', 'expenses.csv', 'activity_log.csv', 'pgbook_invoices.csv'].every(n => files.some(f => f.name === n)))
  check('export rows are real data', files.find(f => f.name === 'tenants.csv')?.content.includes('T One') && files.find(f => f.name === 'pgbook_invoices.csv')?.content.split('\r\n').length === 5)
  await webhook('subscription.charged', sub2, { id: `pay_${run}_4`, amount: 99900 })
  r = await owner('POST', '/tenants', { name: 'T Three', phone: '9000001003', room: 'A3', rentAmount: 8000 })
  check('payment recovered → writable again', r.status === 201, r.data)

  fake.status.set(sub2.id, 'halted')
  r = await owner('POST', '/billing/sync')
  check('"refresh status" asks Razorpay', r.status === 200 && fake.fetched > 0)
  check('…and applies what it says (halted → read-only)', r.data.state.status === 'unpaid' && r.data.state.readOnly)
  await webhook('subscription.charged', sub2, { id: `pay_${run}_5`, amount: 99900 })

  console.log('\nCancelling')
  r = await owner('POST', '/billing/cancel', {})
  check('cancelling needs a reason', r.status === 400)
  r = await owner('POST', '/billing/cancel', { reason: 'Closing one PG' })
  check('cancelled at the end of the period', r.status === 200 && r.data.state.status === 'cancelling' && fake.cancelled.some(c => c.id === sub2.id && c.cancel_at_cycle_end === 1), r.data?.state)
  r = await owner('POST', '/tenants', { name: 'T Four', phone: '9000001004', room: 'A4', rentAmount: 8000 })
  check('full access until the period ends', r.status === 201)
  await users.updateOne({ _id: orgId }, { $set: { 'billing.currentPeriodEnd': new Date(Date.now() - 86400000) } })
  r = await owner('GET', '/billing')
  check('after the period: ended, read-only, data kept 90 days', r.data.state.status === 'ended' && r.data.state.readOnly && !!r.data.state.retentionUntil)
  r = await owner('POST', '/billing/mock', { outcome: 'pay' })
  check('test-mode billing is not available with Razorpay configured', r.status === 404)

  console.log('\nDaily reminders')
  r = await fetch(`${BASE}/cron/daily`)
  check('cron needs the secret', r.status === 401)
  const soon = client()
  r = await soon('POST', '/auth/signup', { name: 'Soon Ending', pgName: 'Rose PG', email: `soon-${run}@test.com`, password: 'owner-pass-123' })
  const soonId = new mongoose.Types.ObjectId(r.data.user.id)
  await users.updateOne({ _id: soonId }, { $set: { trialEndsAt: new Date(Date.now() + 2 * 86400000) } })
  r = await fetch(`${BASE}/cron/daily`, { headers: { Authorization: `Bearer ${CRON_SECRET}` } })
  const cron = await r.json()
  check('cron runs with the secret', r.status === 200 && cron.ok, cron)
  const reminders = () => db.collection('notifications').countDocuments({ orgId: soonId, type: 'billing.trial_ending' })
  check('trial-ending reminder created', (await reminders()) === 1)
  await fetch(`${BASE}/cron/daily`, { headers: { Authorization: `Bearer ${CRON_SECRET}` } })
  check('running again does not repeat it', (await reminders()) === 1)
} finally {
  server.close()
  await db.dropDatabase()
  await mongoose.disconnect()
}

console.log(`\n${passes} passed, ${failures} failed\n`)
process.exit(failures ? 1 : 0)
