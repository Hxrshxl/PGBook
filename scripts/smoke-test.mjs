// End-to-end API smoke test. Run against a server using a THROWAWAY database:
//   BASE_URL=http://localhost:3000 node scripts/smoke-test.mjs
// It creates two fresh accounts and exercises every endpoint, including the
// security and money-handling cases that were broken in the original audit.

const BASE = (process.env.BASE_URL ?? 'http://localhost:3000') + '/api'
const run = Date.now().toString(36)
let failures = 0
let passes = 0

function check(name, condition, detail = '') {
  if (condition) {
    passes++
    console.log(`  ✓ ${name}`)
  } else {
    failures++
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

function client() {
  let cookie = ''
  return async function call(method, path, body, headers = {}) {
    const res = await fetch(BASE + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}), ...headers },
      body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
    })
    const setCookie = res.headers.get('set-cookie')
    if (setCookie) cookie = setCookie.split(';')[0]
    const data = await res.json().catch(() => null)
    return { status: res.status, data, setCookie }
  }
}

const month = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit' }).format(new Date()).slice(0, 7)

const a = client()
const b = client()

console.log('\nAuth')
let r = await a('POST', '/auth/signup', { name: 'Owner A', pgName: 'A PG', email: `a-${run}@test.com`, password: 'short' })
check('rejects passwords under 8 chars', r.status === 400, `got ${r.status}`)
r = await a('POST', '/auth/signup', { name: 'Owner A', pgName: 'A PG', email: `a-${run}@test.com`, password: 'password-a-123' })
check('signup succeeds', r.status === 201, `got ${r.status} ${JSON.stringify(r.data)}`)
check('session is an httpOnly cookie', /HttpOnly/i.test(r.setCookie ?? ''), r.setCookie)
check('token is not exposed in the body', r.data && !('token' in r.data))
check('password hash is not exposed', r.data?.user && !('password' in r.data.user))
r = await b('POST', '/auth/signup', { name: 'Owner B', email: `b-${run}@test.com`, password: 'password-b-123' })
check('second account signup', r.status === 201)
const userB = r.data.user
r = await a('POST', '/auth/signup', { name: 'Dup', email: `A-${run}@TEST.com`, password: 'password-x-123' })
check('duplicate email (case-insensitive) rejected', r.status === 409)
r = await a('POST', '/auth/login', '')
check('empty login body → 400, not 500', r.status === 400, `got ${r.status}`)
r = await a('POST', '/auth/login', { email: `a-${run}@test.com` })
check('login without password → 400', r.status === 400, `got ${r.status}`)
r = await client()('GET', '/tenants')
check('unauthenticated request → 401', r.status === 401)
r = await a('GET', '/auth/me')
check('/auth/me returns the user', r.status === 200 && r.data.user.email === `a-${run}@test.com`)
r = await a('POST', '/tenants', { name: 'X', phone: '9000000000', room: '1', rentAmount: 1 }, { Origin: 'https://evil.example' })
check('cross-site POST blocked (CSRF)', r.status === 403, `got ${r.status}`)

console.log('\nTenants')
r = await a('POST', '/tenants', { name: 'T1', phone: '+91 90000 00001', room: '101', rentAmount: 10000, moveInDate: `${month}-01` })
check('create tenant', r.status === 201, JSON.stringify(r.data))
const t1 = r.data.tenant
check('creating a tenant also creates this month\'s dues', r.data.payment?.month === month && r.data.payment.rentAmount === 10000)
r = await a('POST', '/tenants', { name: 'T2', phone: '9000000002', room: '102', rentAmount: 8000, moveInDate: `${month}-01` })
const t2 = r.data.tenant
r = await a('POST', '/tenants', { name: 'Future', phone: '9000000003', room: '103', rentAmount: 5000, moveInDate: '2099-01-01' })
check('future move-in gets no dues yet', r.status === 201 && r.data.payment === null)
const tFuture = r.data.tenant
r = await a('POST', '/tenants', { name: 'x' })
check('missing fields → 400 with message', r.status === 400 && typeof r.data.message === 'string', `got ${r.status}`)
r = await a('POST', '/tenants', { name: 'Neg', phone: '9000000004', room: 'Z', rentAmount: -5 })
check('negative rent rejected', r.status === 400)
r = await a('POST', '/tenants', { name: 'Bad', phone: '12', room: 'Z', rentAmount: 5 })
check('invalid phone rejected', r.status === 400)
r = await a('POST', '/tenants', '{bad json')
check('malformed JSON → 400', r.status === 400)
r = await a('PUT', '/tenants/not-an-id', {})
check('bad id → 404, not 500', r.status === 404, `got ${r.status}`)
r = await a('PUT', `/tenants/${t1.id}`, { userId: userB.id, status: 'vacated', name: 'T1 renamed' })
check('PUT ignores userId/status (no mass assignment)', r.status === 200 && r.data.tenant.status === 'active' && r.data.tenant.name === 'T1 renamed')
r = await b('GET', '/tenants')
check('owner B cannot see owner A\'s tenants', r.status === 200 && r.data.length === 0)
r = await b('PUT', `/tenants/${t1.id}`, { name: 'hijack' })
check('owner B cannot edit owner A\'s tenant', r.status === 404)
r = await b('POST', '/complaints', { tenantId: t1.id, description: 'x' })
check('owner B cannot file complaints on A\'s tenant', r.status === 404)

console.log('\nDues & payments')
r = await a('POST', '/payments', { tenantId: t1.id, month })
check('duplicate dues for same tenant+month rejected', r.status === 409, `got ${r.status}`)
r = await a('POST', '/payments', { tenantId: t1.id, month: 'banana' })
check('invalid month rejected', r.status === 400)
r = await a('POST', '/payments/generate', { month })
check('generate dues is idempotent (nothing new)', r.status === 201 && r.data.payments.length === 0, JSON.stringify(r.data))
r = await a('GET', '/payments')
const due1 = r.data.find(p => p.tenantId === t1.id && p.month === month)
check('exactly one dues record per tenant per month', r.data.filter(p => p.tenantId === t1.id && p.month === month).length === 1)
check('no dues for the future tenant', !r.data.some(p => p.tenantId === tFuture.id))
r = await a('POST', `/payments/${due1.id}/transactions`, { amount: 4000, method: 'cash', note: 'part' })
check('record partial payment', r.status === 201 && r.data.amountPaid === 4000 && r.data.status === 'partial', JSON.stringify(r.data))
r = await a('POST', `/payments/${due1.id}/transactions`, { amount: 999999 })
check('overpayment rejected', r.status === 400)
r = await a('POST', `/payments/${due1.id}/transactions`, { amount: -5 })
check('negative payment rejected', r.status === 400)
r = await a('POST', `/payments/${due1.id}/transactions`, { amount: 6000, method: 'upi' })
check('pay balance → paid', r.data.amountPaid === 10000 && r.data.status === 'paid' && r.data.transactions.length === 2)
const firstTx = r.data.transactions[0]
r = await a('DELETE', `/payments/${due1.id}/transactions/${firstTx.id}`)
check('undo a payment entry → back to partial', r.status === 200 && r.data.amountPaid === 6000 && r.data.status === 'partial')
r = await a('PUT', `/payments/${due1.id}`, { rentAmount: 1000 })
check('cannot reduce due below amount already paid', r.status === 400)
r = await a('PUT', `/payments/${due1.id}`, { amountPaid: 999999, status: 'paid' })
check('amountPaid/status cannot be set directly', r.status === 200 && r.data.amountPaid === 6000 && r.data.status === 'partial')
r = await a('DELETE', `/payments/${due1.id}`)
check('cannot delete dues that have payments', r.status === 409)

console.log('\nUtility bills')
r = await a('PATCH', `/tenants/${t2.id}`, { status: 'vacated' })
check('vacate tenant', r.status === 200 && r.data.status === 'vacated' && /^\d{4}-\d{2}-\d{2}$/.test(r.data.moveOutDate))
r = await a('POST', '/utility-bills', { month, type: 'electricity', totalAmount: 1000 })
check('add bill (defaults to active tenants only)', r.status === 201 && r.data.bill.tenantCount === 1, JSON.stringify(r.data))
const bill1 = r.data.bill
r = await a('GET', '/payments')
const t1Due = r.data.find(p => p.tenantId === t1.id && p.month === month)
const t2Due = r.data.find(p => p.tenantId === t2.id && p.month === month)
check('active tenant charged the share', t1Due.utilityShare === 1000)
check('vacated tenant NOT charged', t2Due.utilityShare === 0)
r = await a('POST', '/tenants', { name: 'T3', phone: '9000000005', room: '104', rentAmount: 7000, moveInDate: `${month}-01` })
const t3 = r.data.tenant
r = await a('POST', '/utility-bills', { month, type: 'water', totalAmount: 100, tenantIds: [t1.id, t3.id, tFuture.id] })
check('split 100 three ways adds up exactly', r.status === 201 && Math.round(r.data.bill.allocations.reduce((s, x) => s + x.amount, 0) * 100) === 10000, JSON.stringify(r.data.bill?.allocations))
const bill2 = r.data.bill
r = await a('DELETE', `/utility-bills/${bill1.id}`)
check('delete bill', r.status === 200)
r = await a('GET', '/payments')
const t1After = r.data.find(p => p.tenantId === t1.id && p.month === month)
check('deleting a bill reverses its charges', t1After.utilityShare === bill2.allocations.find(x => x.tenantId === t1.id).amount, `utilityShare=${t1After.utilityShare}`)
r = await a('POST', '/utility-bills', { month, totalAmount: 100, tenantIds: [userB.id] })
check('cannot charge tenants you do not own', r.status === 400)

console.log('\nComplaints & settings')
r = await a('POST', '/complaints', { tenantId: t1.id, description: 'Leaking tap', tenantName: 'spoofed', category: 'plumbing' })
check('complaint name comes from the tenant record', r.status === 201 && r.data.tenantName === 'T1 renamed')
const c1 = r.data
r = await a('PATCH', `/complaints/${c1.id}`, { status: 'hacked' })
check('invalid complaint status rejected', r.status === 400)
r = await a('PATCH', `/complaints/${c1.id}`, { status: 'resolved' })
check('resolve sets resolvedAt', r.status === 200 && r.data.resolvedAt)
r = await a('PATCH', `/complaints/${c1.id}`, { status: 'open' })
check('re-open clears resolvedAt', r.data.resolvedAt === null)
r = await a('PUT', '/settings', { upiId: 'a@upi', address: 'Addr 1' })
r = await a('PUT', '/settings', { phone: '9999999999' })
check('settings partial update keeps other fields', r.data.upiId === 'a@upi' && r.data.address === 'Addr 1' && r.data.phone === '9999999999')
r = await a('PUT', '/settings', { rentDueDay: 40 })
check('invalid due day rejected', r.status === 400)

console.log('\nDeletes & account')
r = await a('DELETE', `/tenants/${t3.id}`)
check('delete tenant', r.status === 200)
r = await a('GET', '/payments')
check('tenant delete cascades their dues', !r.data.some(p => p.tenantId === t3.id))
r = await a('PUT', '/auth/password', { currentPassword: 'wrong', newPassword: 'new-password-123' })
check('password change needs current password', r.status === 400)
const a2 = client()
await a2('POST', '/auth/login', { email: `a-${run}@test.com`, password: 'password-a-123' })
r = await a('PUT', '/auth/password', { currentPassword: 'password-a-123', newPassword: 'new-password-123' })
check('password change succeeds', r.status === 200)
r = await a2('GET', '/auth/me')
check('password change signs out other sessions', r.status === 401)
r = await a('GET', '/auth/me')
check('current session stays signed in', r.status === 200)
r = await a('POST', '/auth/logout')
r = await a('GET', '/auth/me')
check('logout ends the session', r.status === 401)

console.log('\nRate limiting')
const c = client()
let limited = false
for (let i = 0; i < 12; i++) {
  r = await c('POST', '/auth/login', { email: `b-${run}@test.com`, password: 'wrong' })
  if (r.status === 429) limited = true
}
check('repeated failed logins get rate limited', limited)

console.log(`\n${passes} passed, ${failures} failed\n`)
process.exit(failures ? 1 : 0)
