// End-to-end test of Phase 3: properties, rooms & beds, staff roles and property scoping,
// owner approvals, cash handover, late fees, recurring charges, expenses, and the
// automatic upgrade of accounts created before properties existed.
// Use a THROWAWAY database (name must contain "test"); it is dropped at the end.
//
//   MONGODB_URI=mongodb://127.0.0.1:27017/pgbook_team_test BASE_URL=http://localhost:3000 node scripts/team-smoke-test.mjs
import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'

const BASE = (process.env.BASE_URL ?? 'http://localhost:3000') + '/api'
const DB = process.env.MONGODB_URI
if (!DB || !/test|smoke|tmp/i.test(DB)) {
  console.error('Set MONGODB_URI to a throwaway database (name must contain "test").')
  process.exit(1)
}
const run = Date.now().toString(36)
let passes = 0
let failures = 0
function check(name, ok, detail = '') {
  if (ok) { passes++; console.log(`  ✓ ${name}`) } else { failures++; console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`) }
}

function client() {
  const jar = new Map()
  return async function call(method, path, body) {
    const res = await fetch(BASE + path, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(jar.size ? { Cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; ') } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    for (const c of res.headers.getSetCookie()) {
      const [pair] = c.split(';')
      const [name, ...v] = pair.split('=')
      if (!v.join('=') || /max-age=0/i.test(c)) jar.delete(name)
      else jar.set(name, v.join('='))
    }
    const data = await res.json().catch(() => null)
    return { status: res.status, data }
  }
}

const month = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date()).slice(0, 7)
const tokenOf = url => new URL(url).searchParams.get('token')

await mongoose.connect(DB)
const db = mongoose.connection.db
try {
  console.log('\nProperties & rooms')
  const owner = client()
  let r = await owner('POST', '/auth/signup', { name: 'Owner Three', pgName: 'Lotus PG', email: `o3-${run}@test.com`, password: 'owner-pass-123' })
  r = await owner('GET', '/auth/me')
  check('owner access context', r.status === 200 && r.data.access.role === 'owner' && r.data.access.permissions.includes('team.manage'))
  check('owner has no platform capabilities', !r.data.access.permissions.includes('orgs.suspend'))
  r = await owner('GET', '/properties')
  check('first property created automatically from PG name', r.status === 200 && r.data.length === 1 && r.data[0].name === 'Lotus PG')
  const p1 = r.data[0]
  r = await owner('POST', '/properties', { name: 'Lotus PG — Annexe', address: 'HSR Layout' })
  check('owner adds a second property', r.status === 201)
  const p2 = r.data
  r = await owner('PUT', `/properties/${p1.id}`, { gstin: 'NOT-A-GSTIN' })
  check('invalid GSTIN rejected', r.status === 400)
  r = await owner('PUT', `/properties/${p1.id}`, { gstin: '29ABCDE1234F1Z5', upiId: 'lotus@upi' })
  check('GSTIN and UPI saved', r.status === 200 && r.data.gstin === '29ABCDE1234F1Z5')

  r = await owner('POST', '/rooms', { propertyId: p1.id, name: 'A-1', capacity: 2, rent: 9000 })
  const roomA = r.data
  check('room created', r.status === 201 && roomA.capacity === 2)
  r = await owner('POST', '/rooms', { propertyId: p1.id, name: 'A-1', capacity: 1 })
  check('duplicate room name rejected', r.status === 409)
  r = await owner('POST', '/rooms', { propertyId: p2.id, name: 'B-1', capacity: 1, rent: 12000 })
  const roomB = r.data

  console.log('\nTenants, beds & recurring charges')
  r = await owner('POST', '/tenants', { name: 'Tina', phone: '9000000101', roomId: roomA.id, rentAmount: 9000 })
  check('with 2 properties the property must be chosen', r.status === 400)
  r = await owner('POST', '/tenants', { propertyId: p1.id, name: 'Tina One', phone: '9000000101', roomId: roomA.id, rentAmount: 9000, idType: 'aadhaar', idNumber: 'XXXX-XXXX-1111', recurringCharges: [{ label: 'Food', amount: 3000 }] })
  check('tenant placed in room with food charge', r.status === 201 && r.data.tenant.room === 'A-1')
  check('due includes the food charge', r.data.payment?.extraCharges?.[0]?.amount === 3000 && r.data.payment.status === 'pending')
  const t1 = r.data.tenant
  const due1 = r.data.payment
  r = await owner('POST', '/tenants', { propertyId: p1.id, name: 'Tara Two', phone: '9000000102', roomId: roomA.id, rentAmount: 9000 })
  const t2 = r.data.tenant
  r = await owner('POST', '/tenants', { propertyId: p1.id, name: 'Tom Three', phone: '9000000103', roomId: roomA.id, rentAmount: 9000 })
  check('full room is refused with a clear message', r.status === 409 && /full/.test(r.data.message))
  r = await owner('POST', '/tenants', { propertyId: p2.id, name: 'Bina Annexe', phone: '9000000104', roomId: roomB.id, rentAmount: 12000 })
  const tB = r.data.tenant
  r = await owner('PUT', `/rooms/${roomA.id}`, { capacity: 1 })
  check('cannot shrink a room below its occupants', r.status === 409)
  r = await owner('PUT', `/rooms/${roomA.id}`, { name: 'A-101' })
  r = await owner('GET', '/tenants')
  check('renaming a room updates its tenants', r.data.find(t => t.id === t1.id)?.room === 'A-101')
  r = await owner('PUT', `/tenants/${t1.id}`, { recurringCharges: [{ label: 'Food', amount: 3500 }] })
  check('changing charges updates unpaid dues', r.status === 200 && r.data.payments[0]?.extraCharges[0]?.amount === 3500)

  console.log('\nStaff invites')
  r = await owner('POST', '/team', { name: 'Self', email: `o3-${run}@test.com`, role: 'manager' })
  check("can't invite yourself", r.status === 400)
  const otherOwner = client()
  await otherOwner('POST', '/auth/signup', { name: 'Other Owner', email: `other-${run}@test.com`, password: 'owner-pass-456' })
  r = await owner('POST', '/team', { name: 'Other', email: `other-${run}@test.com`, role: 'manager' })
  check("can't invite another owner's login", r.status === 409)
  r = await owner('POST', '/team', { name: 'Mona Manager', email: `mgr-${run}@test.com`, role: 'manager' })
  check('invite manager (all properties) → link', r.status === 201 && /\/join\?token=/.test(r.data.inviteUrl))
  const mgrToken = tokenOf(r.data.inviteUrl)
  r = await owner('POST', '/team', { name: 'Ajay Accountant', email: `acc-${run}@test.com`, role: 'accountant', propertyIds: [p1.id] })
  const accToken = tokenOf(r.data.inviteUrl)
  r = await owner('POST', '/team', { name: 'Ramu Caretaker', email: `care-${run}@test.com`, role: 'caretaker', propertyIds: [p1.id] })
  const careToken = tokenOf(r.data.inviteUrl)
  const careMemberId = r.data.member.id

  const mgr = client()
  const acc = client()
  const care = client()
  r = await care('GET', `/join?token=${careToken}`)
  check('join link shows role and PG', r.status === 200 && r.data.role === 'Caretaker' && r.data.pgName === 'Lotus PG')
  r = await care('POST', '/join', { token: careToken, password: 'short' })
  check('staff password needs 8+ characters', r.status === 400)
  r = await care('POST', '/join', { token: careToken, name: 'Ramu', password: 'care-pass-123' })
  check('caretaker joins and is signed in', r.status === 201)
  r = await care('POST', '/join', { token: careToken, password: 'care-pass-123' })
  check('join link is single-use', r.status === 410)
  await mgr('POST', '/join', { token: mgrToken, password: 'mgr-pass-1234' })
  await acc('POST', '/join', { token: accToken, password: 'acc-pass-1234' })
  r = await acc('GET', '/auth/me')
  check('accountant scoped to one property', r.data.access.role === 'accountant' && r.data.access.propertyIds?.length === 1)

  console.log('\nRole permissions & property scoping')
  r = await care('GET', '/tenants')
  check('caretaker sees only their property', r.status === 200 && r.data.length === 2 && !r.data.some(t => t.id === tB.id))
  check('caretaker cannot see ID numbers', r.data.every(t => !('idNumber' in t)))
  r = await mgr('GET', '/tenants')
  check('manager sees all properties and ID numbers', r.data.length === 3 && r.data.find(t => t.id === t1.id)?.idNumber === 'XXXX-XXXX-1111')
  r = await care('GET', '/utility-bills')
  check('caretaker cannot see bills', r.status === 403)
  r = await care('POST', '/tenants', { propertyId: p1.id, name: 'X', phone: '9000000199', room: 'Z', rentAmount: 1 })
  check('caretaker cannot add tenants', r.status === 403)
  r = await care('POST', `/payments/${due1.id}/transactions`, { amount: 100 })
  check('caretaker cannot record payments directly', r.status === 403)
  r = await acc('GET', '/payments')
  check('accountant sees only their property dues', r.status === 200 && r.data.every(p => p.propertyId === p1.id))
  r = await acc('GET', `/tenants`)
  check('accountant cannot see ID numbers', r.data.every(t => !('idNumber' in t)))
  const dueB = (await owner('GET', '/payments')).data.find(p => p.tenantId === tB.id)
  r = await acc('POST', `/payments/${dueB.id}/transactions`, { amount: 100 })
  check('accountant cannot touch another property', r.status === 404)
  r = await acc('DELETE', `/tenants/${t2.id}`)
  check('only the owner can delete tenants', r.status === 403)
  r = await mgr('POST', '/team', { name: 'Y', email: `y-${run}@test.com`, role: 'caretaker' })
  check('only the owner manages the team', r.status === 403)

  console.log('\nCash handover')
  r = await care('POST', '/cash', { paymentId: due1.id, amount: 999999 })
  check('cash above the balance rejected', r.status === 400)
  r = await care('POST', '/cash', { paymentId: due1.id, amount: 5000, note: 'Paid at gate' })
  check('caretaker logs cash collection', r.status === 201 && r.data.status === 'pending')
  const cashId = r.data.id
  r = await care('POST', '/cash', { paymentId: due1.id, amount: 7600 })
  check('pending cash counts against the balance', r.status === 400)
  r = await (await owner('GET', '/payments')).data.find(p => p.id === due1.id)
  check('unconfirmed cash is not yet a payment', r.amountPaid === 0)
  r = await owner('DELETE', `/payments/${due1.id}`)
  check('dues with cash waiting for confirmation cannot be deleted', r.status === 409)
  r = await acc('POST', `/cash/${cashId}`, { decision: 'confirm' })
  check('accountant confirms the handover', r.status === 200 && r.data.payment.amountPaid === 5000)
  check('payment is attributed to the caretaker', r.data.payment.transactions[0].recordedBy?.name === 'Ramu')
  r = await acc('POST', `/cash/${cashId}`, { decision: 'confirm' })
  check('a collection cannot be confirmed twice', r.status === 409)

  console.log('\nApprovals: staff ask, owner decides')
  r = await acc('PUT', `/payments/${due1.id}`, { rentAmount: 8000 })
  check('accountant dues change needs a reason', r.status === 400)
  r = await acc('PUT', `/payments/${due1.id}`, { rentAmount: 8000, reason: 'Agreed discount for repairs' })
  check('accountant dues change goes to approval', r.status === 202 && r.data.approval.status === 'pending')
  const adjustId = r.data.approval.id
  const tx = (await owner('GET', '/payments')).data.find(p => p.id === due1.id).transactions[0]
  r = await acc('DELETE', `/payments/${due1.id}/transactions/${tx.id}`, { reason: 'Entered twice' })
  check('accountant payment removal goes to approval', r.status === 202)
  const removeId = r.data.approval.id
  const due2 = (await owner('GET', '/payments')).data.find(p => p.tenantId === t2.id)
  r = await mgr('PUT', `/payments/${due2.id}`, { rentAmount: 8500, reason: 'Small discount' })
  check('manager small change applies directly', r.status === 200 && r.data.rentAmount === 8500)
  r = await mgr('PUT', `/payments/${due2.id}`, { rentAmount: 2000, reason: 'Big discount' })
  check('manager large change needs approval', r.status === 202)
  r = await acc('POST', `/approvals/${adjustId}`, { decision: 'approve' })
  check('staff cannot approve', r.status === 403)
  r = await otherOwner('POST', `/approvals/${adjustId}`, { decision: 'approve' })
  check("another owner cannot see this owner's approvals", r.status === 404)
  r = await owner('GET', '/approvals')
  check('owner inbox lists the requests', r.status === 200 && r.data.counts.requests === 3)
  r = await owner('POST', `/approvals/${adjustId}`, { decision: 'approve' })
  check('owner approves → dues changed', r.status === 200 && (await owner('GET', '/payments')).data.find(p => p.id === due1.id).rentAmount === 8000)
  r = await owner('POST', `/approvals/${removeId}`, { decision: 'reject', note: 'It was a real payment' })
  check('owner rejects → payment stays', r.status === 200 && (await owner('GET', '/payments')).data.find(p => p.id === due1.id).amountPaid === 5000)
  r = await acc('GET', '/approvals')
  check('staff see the outcome of their requests', r.data.requests.some(a => a.status === 'approved') && r.data.requests.some(a => a.status === 'rejected'))

  console.log('\nLate fees & expenses')
  await owner('PUT', `/properties/${p1.id}`, { rentDueDay: 1, lateFee: { enabled: true, type: 'flat', amount: 250, graceDays: 0 } })
  const dayOfMonth = Number(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', day: '2-digit' }).format(new Date()))
  r = await acc('POST', '/payments/late-fees', { month })
  const feeOn = (r.data.payments ?? []).find(p => p.id === due1.id)
  if (dayOfMonth > 1) {
    check('late fee added to overdue dues', r.status === 200 && feeOn?.lateFee === 250)
    r = await acc('POST', '/payments/late-fees', { month })
    check('applying late fees again changes nothing', r.data.payments.length === 0)
  } else {
    check('no late fee on the due date itself', r.status === 200 && !feeOn)
  }
  r = await acc('POST', '/expenses', { propertyId: p1.id, date: `${month}-01`, category: 'groceries', amount: 18000, paidTo: 'Metro' })
  check('accountant records an expense', r.status === 201 && r.data.month === month)
  r = await care('GET', '/expenses')
  check('caretaker cannot see expenses', r.status === 403)

  console.log('\nActivity, removal, suspension')
  r = await owner('GET', '/activity')
  const roles = new Set((r.data.events ?? []).map(e => e.actor.role))
  check('owner activity shows staff actions with roles', roles.has('caretaker') && roles.has('accountant'))
  r = await owner('DELETE', `/team/${careMemberId}`)
  r = await care('GET', '/tenants')
  check('removed staff are signed out immediately', r.status === 401)
  r = await care('POST', '/auth/login', { email: `care-${run}@test.com`, password: 'care-pass-123' })
  check('removed staff cannot sign in', r.status === 403)
  await db.collection('users').updateOne({ email: `o3-${run}@test.com` }, { $set: { status: 'suspended' } })
  r = await mgr('GET', '/tenants')
  check("suspending the owner blocks their staff", r.status === 401)
  await db.collection('users').updateOne({ email: `o3-${run}@test.com` }, { $set: { status: 'active' } })

  console.log('\nUpgrade of an account created before properties existed')
  const legacyId = new mongoose.Types.ObjectId()
  await db.collection('users').insertOne({
    _id: legacyId, name: 'Legacy Owner', email: `legacy-${run}@test.com`, password: await bcrypt.hash('legacy-pass-1', 10),
    plan: 'trial', tokenVersion: 0, status: 'active', createdAt: new Date(), updatedAt: new Date(),
    pgSettings: { pgName: 'Old Mansion PG', upiId: 'old@upi', rentDueDay: 7, totalBeds: 10 },
  })
  await db.collection('tenants').insertMany([
    { userId: legacyId, name: 'L1', phone: '9000000201', room: 'R-1', rentAmount: 7000, status: 'active', recurringCharges: [] },
    { userId: legacyId, name: 'L2', phone: '9000000202', room: 'R-1', rentAmount: 7000, status: 'active', recurringCharges: [] },
    { userId: legacyId, name: 'L3', phone: '9000000203', room: 'R-2', rentAmount: 8000, status: 'vacated', recurringCharges: [] },
  ])
  const legacy = client()
  r = await legacy('POST', '/auth/login', { email: `legacy-${run}@test.com`, password: 'legacy-pass-1' })
  check('legacy owner signs in', r.status === 200)
  const [props, rooms, tenants] = await Promise.all([legacy('GET', '/properties'), legacy('GET', '/rooms'), legacy('GET', '/tenants')])
  check('legacy settings became a property', props.data.length === 1 && props.data[0].name === 'Old Mansion PG' && props.data[0].upiId === 'old@upi' && props.data[0].rentDueDay === 7)
  check('rooms created from existing room names', rooms.data.length === 2 && rooms.data.find(x => x.name === 'R-1')?.capacity === 2)
  check('existing tenants linked to property and rooms', tenants.data.every(t => t.propertyId && t.roomId))
} finally {
  await db.dropDatabase()
  await mongoose.disconnect()
}

console.log(`\n${passes} passed, ${failures} failed\n`)
process.exit(failures ? 1 : 0)
