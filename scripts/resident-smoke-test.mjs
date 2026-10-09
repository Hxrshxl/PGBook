// End-to-end test of Phase 4, the tenant app: phone sign-in, isolation between stays and
// realms, "I've paid" claims, complaints with photos, notices, move-out notice and the
// deposit settlement, plus read-only access after moving out.
// Use a THROWAWAY database (name must contain "test"); it is dropped at the end.
// The server must run with PGBOOK_DEV_FALLBACKS=true (login codes come back in the response
// on localhost because no SMS provider is configured).
//
//   MONGODB_URI=mongodb://127.0.0.1:27017/pgbook_resident_test BASE_URL=http://localhost:3000 node scripts/resident-smoke-test.mjs
import mongoose from 'mongoose'

const ORIGIN = process.env.BASE_URL ?? 'http://localhost:3000'
const BASE = `${ORIGIN}/api`
const DB = process.env.MONGODB_URI
if (!DB || !/test|smoke|tmp/i.test(DB)) {
  console.error('Set MONGODB_URI to a throwaway database (name must contain "test").')
  process.exit(1)
}
const run = Date.now().toString(36)
const uniq = String(Date.now()).slice(-5)
let passes = 0
let failures = 0
function check(name, ok, detail = '') {
  if (ok) { passes++; console.log(`  ✓ ${name}`) } else { failures++; console.log(`  ✗ ${name}${detail ? ` — ${typeof detail === 'string' ? detail : JSON.stringify(detail)}` : ''}`) }
}

function client() {
  const jar = new Map()
  const cookie = () => (jar.size ? { Cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; ') } : {})
  const keep = res => {
    for (const c of res.headers.getSetCookie()) {
      const [pair] = c.split(';')
      const [name, ...v] = pair.split('=')
      if (!v.join('=') || /max-age=0/i.test(c)) jar.delete(name)
      else jar.set(name, v.join('='))
    }
  }
  const call = async (method, path, body, headers = {}) => {
    const res = await fetch(BASE + path, {
      method,
      headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...cookie(), ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    keep(res)
    return { status: res.status, data: await res.json().catch(() => null), headers: res.headers }
  }
  call.upload = async (path, bytes, type, headers = {}) => {
    const form = new FormData()
    form.append('file', new Blob([bytes], { type }), 'photo')
    const res = await fetch(BASE + path, { method: 'POST', headers: { ...cookie(), ...headers }, body: form })
    return { status: res.status, data: await res.json().catch(() => null) }
  }
  call.raw = async path => fetch(BASE + path, { headers: cookie() })
  call.page = async path => fetch(ORIGIN + path, { headers: cookie(), redirect: 'manual' })
  return call
}

async function signIn(phone) {
  const c = client()
  const otp = await c('POST', '/resident/otp', { phone })
  const v = await c('POST', '/resident/verify', { phone, code: otp.data?.devCode })
  return { c, otp, v }
}

const tz = 'Asia/Kolkata'
const today = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date())
const month = today.slice(0, 7)
const prevMonth = (() => { const [y, m] = month.split('-').map(Number); return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}` })()
const addDays = (iso, n) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10)
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]), Buffer.alloc(64, 1)])
const phoneA = `98${uniq}001`.slice(0, 10)
const phoneB = `98${uniq}002`.slice(0, 10)

await mongoose.connect(DB)
const db = mongoose.connection.db
let r
try {
  console.log('\nSetup')
  const ownerA = client()
  await ownerA('POST', '/auth/signup', { name: 'Owner A', pgName: 'Sunrise PG', email: `ra-${run}@test.com`, password: 'owner-pass-123' })
  const [propA] = (await ownerA('GET', '/properties')).data
  await ownerA('PUT', `/properties/${propA.id}`, { upiId: 'sunrise@upi', rentDueDay: 5, noticePeriodDays: 30 })
  r = await ownerA('POST', '/tenants', { name: 'Asha Rao', phone: phoneA, room: 'B-204', rentAmount: 9000, depositAmount: 18000, moveInDate: `${prevMonth}-01`, notes: 'Owner-only note about Asha' })
  const t1 = r.data.tenant
  check('tenant with a phone number', r.status === 201)
  r = await ownerA('POST', '/payments', { tenantId: t1.id, month: prevMonth })
  check('last month\'s dues too', r.status === 201 || r.status === 200, r.data)
  r = await ownerA('POST', '/tenants', { name: 'Ravi K', phone: phoneB, room: 'B-205', rentAmount: 8000, depositAmount: 8000, moveInDate: `${month}-01` })
  const t2 = r.data.tenant
  const ownerB = client()
  await ownerB('POST', '/auth/signup', { name: 'Owner B', pgName: 'Lotus PG', email: `rb-${run}@test.com`, password: 'owner-pass-123' })
  r = await ownerB('POST', '/tenants', { name: 'Asha Rao', phone: `+91 ${phoneA.slice(0, 5)} ${phoneA.slice(5)}`, room: 'L-1', rentAmount: 7000, moveInDate: `${month}-01` })
  const t3 = r.data.tenant
  check('same person also stays at another owner\'s PG (number typed differently)', r.status === 201)

  console.log('\nPhone sign-in')
  const anon = client()
  r = await anon('POST', '/resident/otp', { phone: '9811111111' })
  check('unknown number: same answer, nothing sent', r.status === 200 && !r.data.devCode && /If this number/.test(r.data.message))
  r = await anon('POST', '/resident/otp', { phone: '12345' })
  check('invalid number refused', r.status === 400)
  const asha = client()
  r = await asha('POST', '/resident/otp', { phone: phoneA })
  const code = r.data.devCode
  check('code sent (shown in dev mode on localhost)', r.status === 200 && /^\d{6}$/.test(code ?? ''), r.data)
  r = await asha('POST', '/resident/verify', { phone: phoneA, code: code === '000000' ? '111111' : '000000' })
  check('wrong code refused with attempts left', r.status === 400 && /attempts? left/.test(r.data.message), r.data)
  r = await asha('POST', '/resident/verify', { phone: phoneA, code })
  check('right code signs in', r.status === 200 && r.headers.getSetCookie().some(c => c.startsWith('pgbook_resident=')))
  check('both stays linked, at both PGs', r.data.tenancies.length === 2 && r.data.tenancies.some(t => t.pgName === 'Sunrise PG') && r.data.tenancies.some(t => t.pgName === 'Lotus PG'), r.data.tenancies)
  r = await anon('POST', '/resident/verify', { phone: phoneA, code })
  check('a code works only once', r.status === 400)
  const A = { 'X-Tenancy': t1.id }

  console.log('\nIsolation')
  r = await asha('GET', '/tenants')
  check('tenant session cannot use the owner API', r.status === 401)
  r = await ownerA('GET', '/resident/me')
  check('owner session cannot use the tenant API', r.status === 401)
  r = await asha('GET', '/resident/summary', undefined, { 'X-Tenancy': t2.id })
  check('cannot open someone else\'s stay', r.status === 404)
  r = await asha('GET', '/resident/summary')
  check('a stay must be chosen', r.status === 400)
  r = await asha.page('/t/home')
  check('tenant app pages open when signed in', r.status === 200)
  r = await anon.page('/t/home')
  check('…and redirect to sign-in when not', r.status === 307 && r.headers.get('location')?.endsWith('/t'))

  console.log('\nRent and "I\'ve paid"')
  r = await asha('GET', '/resident/summary', undefined, A)
  check('home shows both unpaid months', r.status === 200 && r.data.dues.totalDue === 18000 && r.data.dues.openMonths.length === 2, r.data?.dues)
  check('UPI deep-link data uses the PG\'s UPI ID', r.data.dues.upi?.pa === 'sunrise@upi' && r.data.dues.upi.am === 18000)
  const current = r.data.dues.openMonths.find(m => m.month === month)
  const previous = r.data.dues.openMonths.find(m => m.month === prevMonth)
  r = await asha('POST', '/resident/claims', { paymentId: current.id, amount: 9000, date: today, method: 'upi', utr: '' }, A)
  check('UPI claim needs the UTR', r.status === 400)
  r = await asha('POST', '/resident/claims', { paymentId: current.id, amount: 9000, date: today, method: 'upi', utr: `utr${uniq}9` }, A)
  check('claim submitted, not flagged', r.status === 201 && r.data.status === 'pending' && r.data.utr === `UTR${uniq}9`, r.data)
  const claim1 = r.data
  r = await asha('POST', '/resident/claims', { paymentId: current.id, amount: 500, date: today, method: 'upi', utr: `UTR${uniq}9` }, A)
  const claim2 = r.data
  r = await ownerA('GET', '/approvals')
  const c2 = r.data.claims.find(c => c.id === claim2.id)
  check('owner sees both claims; the duplicate is flagged', r.data.counts.claims === 2 && c2.flags.includes('duplicate_utr') && c2.flags.includes('over_balance'), c2)
  r = await asha('GET', '/resident/summary', undefined, A)
  check('reported amounts reduce the UPI amount', r.data.dues.pendingClaimTotal === 9500 && r.data.dues.upi.am === 8500)
  r = await ownerA('POST', `/claims/${claim1.id}`, { decision: 'approve' })
  check('owner approves: payment on the ledger', r.status === 200 && r.data.payment.amountPaid === 9000 && r.data.payment.transactions.at(-1).source === 'claim', r.data)
  r = await ownerA('POST', `/claims/${claim1.id}`, { decision: 'approve' })
  check('a claim cannot be approved twice', r.status === 409)
  r = await ownerA('POST', `/claims/${claim2.id}`, { decision: 'approve' })
  check('over-balance claim cannot be approved', r.status === 409)
  r = await ownerA('POST', `/claims/${claim2.id}`, { decision: 'reject' })
  check('rejecting needs a reason', r.status === 400)
  r = await ownerA('POST', `/claims/${claim2.id}`, { decision: 'reject', note: 'Duplicate of the earlier payment' })
  check('owner rejects with a reason', r.status === 200 && r.data.claim.status === 'rejected')
  r = await asha('GET', '/resident/dues', undefined, A)
  const cur = r.data.dues.find(d => d.month === month)
  check('tenant sees the confirmed payment and the rejection reason', cur.status === 'paid' && cur.claims.some(c => c.status === 'rejected' && /Duplicate/.test(c.decisionNote)))
  r = await asha('GET', `/resident/receipts/${cur.id}`, undefined, A)
  check('receipt available', r.status === 200 && r.data.payment.amountPaid === 9000 && r.data.settings.pgName === 'Sunrise PG')
  r = await asha('GET', '/resident/notifications')
  check('tenant notified', r.data.notifications.some(n => n.type === 'claim.approved') && r.data.notifications.some(n => n.type === 'claim.rejected'))

  console.log('\nComplaints with photos')
  r = await asha.upload('/resident/uploads', Buffer.from('<svg onload=alert(1)></svg>'), 'image/png', A)
  check('non-images refused even if labelled as images', r.status === 415)
  r = await asha.upload('/resident/uploads', PNG, 'image/png', A)
  const photo = r.data?.id
  check('photo uploaded', r.status === 201 && !!photo)
  r = await asha('POST', '/resident/complaints', { category: 'plumbing', description: 'Tap leaking since morning', urgent: true, okToEnter: true, photoIds: [photo] }, A)
  check('complaint raised with photo', r.status === 201 && r.data.photoIds.length === 1 && r.data.priority === 'high')
  const complaint = r.data
  r = await asha('POST', '/resident/complaints', { category: 'plumbing', description: 'Same photo again', photoIds: [photo] }, A)
  check('a photo cannot be attached twice', r.status === 400)
  r = await ownerA('GET', '/complaints')
  const oc = r.data.find(c => c.id === complaint.id)
  check('owner sees it as from the tenant app', oc?.source === 'resident' && oc.okToEnter && oc.photoIds[0] === photo)
  r = await ownerA.raw(`/files/${photo}`)
  check('owner can open the photo', r.status === 200 && r.headers.get('content-type') === 'image/png' && r.headers.get('x-content-type-options') === 'nosniff')
  r = await asha.raw(`/files/${photo}`)
  check('tenant can open their own photo', r.status === 200)
  r = await ownerB.raw(`/files/${photo}`)
  check('another owner cannot', r.status === 404)
  const { c: ravi, v: raviLogin } = await signIn(phoneB)
  check('second tenant signs in', raviLogin.status === 200 && raviLogin.data.tenancies.length === 1)
  r = await ravi.raw(`/files/${photo}`)
  check('another tenant of the same PG cannot', r.status === 404)
  await ownerA('PATCH', `/complaints/${complaint.id}`, { status: 'resolved', ownerNotes: 'Plumber replaced the washer' })
  r = await asha('GET', '/resident/complaints', undefined, A)
  check('tenant sees the fix and the PG\'s update', r.data[0].status === 'resolved' && r.data[0].update === 'Plumber replaced the washer')
  r = await asha('POST', `/resident/complaints/${complaint.id}`, { action: 'reopen' }, A)
  check('tenant can reopen within 7 days', r.status === 200 && r.data.status === 'open' && r.data.reopenCount === 1)
  await ownerA('PATCH', `/complaints/${complaint.id}`, { status: 'resolved' })
  r = await asha('POST', `/resident/complaints/${complaint.id}`, { action: 'confirm' }, A)
  check('tenant confirms the fix', r.status === 200 && !!r.data.closedAt && r.data.closedBy === 'resident')

  console.log('\nNotices')
  r = await ownerA('POST', '/notices', { title: 'Water off on Sunday', body: '10 am to 2 pm', requiresAck: true })
  check('owner publishes a notice', r.status === 201)
  const notice = r.data
  r = await asha('GET', '/resident/notices', undefined, A)
  check('tenant sees it', r.data.some(n => n.id === notice.id && !n.acknowledged))
  r = await asha('POST', `/resident/notices/${notice.id}`, undefined, A)
  check('tenant acknowledges', r.status === 200 && r.data.acknowledged)
  r = await asha('GET', '/resident/notices', undefined, { 'X-Tenancy': t3.id })
  check('notices stay within their PG', !r.data.some(n => n.id === notice.id))
  r = await ownerA('GET', '/notices')
  check('owner sees who read it', r.data.find(n => n.id === notice.id)?.acks.length === 1)

  console.log('\nMove-out and deposit')
  r = await asha('POST', '/resident/moveout', { moveOutDate: addDays(today, 10), reason: 'New job in Pune' }, A)
  check('notice given; flagged as short notice', r.status === 201 && r.data.shortNotice === true)
  r = await asha('POST', '/resident/moveout', { moveOutDate: addDays(today, 40) }, A)
  check('only one notice at a time', r.status === 409)
  r = await ownerA('GET', '/approvals')
  const mo = r.data.moveOuts.find(m => m.status === 'pending')
  check('owner sees the notice', !!mo && r.data.counts.moveOuts === 1)
  r = await ownerA('POST', `/moveouts/${mo.id}`, { decision: 'acknowledge' })
  check('owner acknowledges', r.status === 200)
  r = await ownerA('GET', '/tenants')
  check('tenant is now on notice', !!r.data.find(t => t.id === t1.id)?.noticeGivenAt)
  r = await asha('DELETE', `/resident/moveout/${mo.id}`, undefined, A)
  check('acknowledged notice cannot be withdrawn in the app', r.status === 409)

  r = await ownerA('POST', '/settlements', { tenantId: t1.id })
  const s = r.data
  check('settlement drafted from the ledger', r.status === 201 && s.deposit === 18000 && s.unpaidDues.length === 1 && s.unpaidDues[0].amount === 9000 && s.refundAmount === 9000, s)
  r = await ownerA('PUT', `/settlements/${s.id}`, { deductions: [{ label: 'Room cleaning', amount: 1000 }] })
  check('deduction lowers the refund', r.data.refundAmount === 8000)
  r = await asha('GET', '/resident/settlement', undefined, A)
  check('tenant cannot see a draft', r.data.settlement === null)
  r = await ownerA('POST', `/settlements/${s.id}`, { action: 'approve' })
  check('owner approves and shares', r.status === 200 && r.data.status === 'shared')
  r = await asha('POST', `/resident/settlement/${s.id}`, { action: 'dispute', comment: 'no' }, A)
  check('a dispute needs an explanation', r.status === 400)
  r = await asha('POST', `/resident/settlement/${s.id}`, { action: 'dispute', comment: 'The room was cleaned by me' }, A)
  check('tenant disputes', r.status === 200 && r.data.status === 'disputed')
  r = await ownerA('PUT', `/settlements/${s.id}`, { deductions: [] })
  check('editing goes back to draft', r.data.status === 'draft' && r.data.refundAmount === 9000)
  await ownerA('POST', `/settlements/${s.id}`, { action: 'approve' })
  r = await asha('POST', `/resident/settlement/${s.id}`, { action: 'accept' }, A)
  check('tenant accepts the revised settlement', r.status === 200 && r.data.status === 'accepted')
  r = await ownerA('POST', `/settlements/${s.id}`, { action: 'refund', method: 'upi', reference: '', date: today })
  check('refund needs a reference', r.status === 400)
  r = await ownerA('POST', `/settlements/${s.id}`, { action: 'refund', method: 'upi', reference: 'REFUND123', date: today })
  check('refund recorded, settlement closed', r.status === 200 && r.data.status === 'closed' && r.data.refund.amount === 9000)
  r = await ownerA('GET', '/payments')
  const prev = r.data.find(p => p.tenantId === t1.id && p.month === prevMonth)
  check('unpaid month settled from the deposit', prev.status === 'paid' && prev.transactions.at(-1).source === 'deposit')
  r = await ownerA('GET', '/tenants')
  check('tenant marked as moved out', r.data.find(t => t.id === t1.id)?.status === 'vacated')

  console.log('\nAfter moving out')
  r = await asha('GET', '/resident/summary', undefined, A)
  check('former stay is read-only', r.data.access === 'read' && /moved out/.test(r.data.readReason))
  r = await asha('POST', '/resident/complaints', { category: 'other', description: 'Something here' }, A)
  check('no new complaints after moving out', r.status === 403 && r.data.code === 'READ_ONLY')
  r = await asha('GET', `/resident/receipts/${prev._id ?? prev.id}`, undefined, A)
  check('receipts still available', r.status === 200)
  r = await asha('GET', '/resident/settlement', undefined, A)
  check('settlement still visible', r.data.settlement?.status === 'closed' && r.data.settlement.refund.reference === 'REFUND123')

  console.log('\nPG account read-only')
  await db.collection('users').updateOne({ email: `rb-${run}@test.com` }, { $set: { trialEndsAt: new Date(Date.now() - 86400000) } })
  r = await asha('POST', '/resident/complaints', { category: 'other', description: 'Light not working' }, { 'X-Tenancy': t3.id })
  check('a lapsed PG account pauses new requests', r.status === 403 && /paused/.test(r.data.message))
  r = await asha('GET', '/resident/summary', undefined, { 'X-Tenancy': t3.id })
  check('…but the tenant still sees their dues', r.status === 200 && r.data.access === 'read')

  console.log('\nPrivacy and sign-out')
  r = await asha.raw('/resident/export')
  const exported = await r.json()
  check('download my data: both stays, no owner notes', r.status === 200 && exported.stays.length === 2 && !JSON.stringify(exported).includes('Owner-only note'))
  r = await asha('PUT', '/resident/me', { consent: true })
  check('privacy notice accepted', r.status === 200 && !!r.data.resident.consentAt)
  for (let i = 0; i < 2; i++) await ravi('POST', '/resident/otp', { phone: phoneB })
  r = await ravi('POST', '/resident/otp', { phone: phoneB })
  check('login codes are rate-limited per number', r.status === 429)
  await asha('POST', '/resident/logout')
  r = await asha('GET', '/resident/me')
  check('signed out', r.status === 401)
} finally {
  await db.dropDatabase()
  await mongoose.disconnect()
}

console.log(`\n${passes} passed, ${failures} failed\n`)
process.exit(failures ? 1 : 0)
